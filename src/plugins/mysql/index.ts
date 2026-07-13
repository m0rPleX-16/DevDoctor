import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, CheckStatus } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import type { ConfigCheckResult } from './checks/config-check.js';
import { checkMysqlConfig } from './checks/config-check.js';
import { checkMysqlPort } from './checks/port-check.js';
import { checkMysqlService } from './checks/service-check.js';
import { checkMysqlLog } from './checks/log-check.js';
import { checkMysqlPermissions } from './checks/permissions-check.js';
import { checkService } from '../../infra/system/service-checker.js';
import { runCommand } from '../../infra/os/command-runner.js';
import { getPortOwner } from '../../infra/system/port-checker.js';
import { MYSQL_WINDOWS_SERVICES, MYSQL_UNIX_SERVICES } from './mysql-constants.js';

function deriveOverallStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.includes('skip')) return 'skip';
  return 'pass';
}

/**
 * Resolve the first installed MySQL service name from the candidate list.
 * Shared by repair(), verify(), and rollback() so no duplication.
 */
async function resolveInstalledServiceName(): Promise<string | undefined> {
  const isWindows = process.platform === 'win32';
  const candidates = isWindows ? MYSQL_WINDOWS_SERVICES : MYSQL_UNIX_SERVICES;

  for (const name of candidates) {
    const info = await checkService(name);
    if (info.status !== 'not_installed') {
      return name;
    }
  }

  return undefined;
}

export class MysqlPlugin implements Plugin {
  readonly name = 'mysql';
  readonly displayName = 'MySQL';
  readonly description = 'Diagnoses your MySQL local database environment.';

  /**
   * Cached config from the last diagnose() run.
   * Repair and verify use this to avoid re-parsing my.ini.
   * Reset each time diagnose() is called so it always reflects fresh state.
   */
  private lastConfig: ConfigCheckResult | undefined;

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    // 1. Run config check first — extracts port and error log path
    const configResult = await checkMysqlConfig();
    this.lastConfig = configResult;

    // 2. Run remaining checks in parallel using the config metadata
    const [serviceCheck, portCheck, logCheck, permissionsCheck] = await Promise.all([
      checkMysqlService(),
      checkMysqlPort(configResult.port),
      checkMysqlLog(configResult.logErrorPath),
      checkMysqlPermissions(),
    ]);

    const checks = [configResult.check, serviceCheck, portCheck, logCheck, permissionsCheck];
    const durationMs = Math.round(performance.now() - startTime);

    return {
      pluginName: this.name,
      displayName: this.displayName,
      timestamp: new Date(),
      durationMs,
      checks,
      overallStatus: deriveOverallStatus(checks.map((c) => c.status)),
    };
  }

  async repair(checkName: string): Promise<RepairResult> {
    const isWindows = process.platform === 'win32';

    if (checkName === 'mysql-service') {
      const serviceName = await resolveInstalledServiceName();

      if (!serviceName) {
        return {
          checkName,
          success: false,
          message: 'No registered MySQL system service found to start.',
          rollbackSupported: false,
        };
      }

      const startResult = isWindows
        ? await runCommand('net', ['start', serviceName])
        : await runCommand('sudo', ['systemctl', 'start', serviceName]);

      if (startResult.success) {
        return {
          checkName,
          success: true,
          message: `Successfully started MySQL service "${serviceName}".`,
          detail: startResult.stdout,
          // Starting a service can be reversed by stopping it
          rollbackSupported: true,
        };
      }

      const needElevation =
        startResult.stderr.includes('System error 5') || startResult.exitCode === 5;

      return {
        checkName,
        success: false,
        message: `Failed to start MySQL service "${serviceName}".`,
        detail: needElevation
          ? 'Please run the terminal as Administrator and try again.'
          : startResult.stderr,
        rollbackSupported: false,
      };
    }

    if (checkName === 'mysql-port') {
      // Use cached config from diagnose() if available; otherwise re-read.
      // Re-reading is rare — it only happens if repair() is called without
      // a preceding diagnose() in the same session.
      const config = this.lastConfig ?? (await checkMysqlConfig());
      const owner = await getPortOwner(config.port);

      if (!owner) {
        return {
          checkName,
          success: true,
          message: `Port ${config.port} is already free. No repair needed.`,
          rollbackSupported: false,
        };
      }

      const killResult = isWindows
        ? await runCommand('taskkill', ['/f', '/pid', String(owner.pid)])
        : await runCommand('kill', ['-9', String(owner.pid)]);

      if (killResult.success) {
        return {
          checkName,
          success: true,
          message: `Terminated conflicting process "${owner.processName}" (PID: ${owner.pid}) on port ${config.port}.`,
          detail: killResult.stdout,
          // A killed process cannot be restarted automatically — no rollback
          rollbackSupported: false,
        };
      }

      return {
        checkName,
        success: false,
        message: `Failed to terminate "${owner.processName}" (PID: ${owner.pid}) on port ${config.port}.`,
        detail: killResult.stderr,
        rollbackSupported: false,
      };
    }

    return {
      checkName,
      success: false,
      message: `MySQL plugin does not support automated repairs for "${checkName}".`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    const isWindows = process.platform === 'win32';

    if (checkName === 'mysql-service') {
      const serviceName = await resolveInstalledServiceName();
      const status = serviceName
        ? (await checkService(serviceName)).status
        : 'not_installed';

      const verified = status === 'running';
      return {
        checkName,
        success: verified,
        message: verified
          ? `MySQL service "${serviceName}" is running.`
          : `MySQL service is not running (status: ${status}).`,
      };
    }

    if (checkName === 'mysql-port') {
      const config = this.lastConfig ?? (await checkMysqlConfig());
      const owner = await getPortOwner(config.port);

      const verified =
        !owner ||
        owner.processName.toLowerCase().includes('mysql') ||
        owner.processName.toLowerCase().includes('mariadb');

      return {
        checkName,
        success: verified,
        message: verified
          ? `Port ${config.port} is correctly bound or free.`
          : `Port ${config.port} is still occupied by "${owner!.processName}" (PID: ${owner!.pid}).`,
      };
    }

    return {
      checkName,
      success: false,
      message: `Verification for "${checkName}" is not supported.`,
    };
  }

  /**
   * Rollback a repair that succeeded mechanically but failed verification.
   *
   * Currently only mysql-service supports rollback: if we started the
   * service but something is still wrong, we stop it to restore the
   * previous stopped state rather than leaving a half-working service running.
   */
  async rollback(checkName: string): Promise<RepairResult> {
    const isWindows = process.platform === 'win32';

    if (checkName === 'mysql-service') {
      const serviceName = await resolveInstalledServiceName();

      if (!serviceName) {
        return {
          checkName,
          success: false,
          message: 'Could not find MySQL service to roll back.',
          rollbackSupported: false,
        };
      }

      const stopResult = isWindows
        ? await runCommand('net', ['stop', serviceName])
        : await runCommand('sudo', ['systemctl', 'stop', serviceName]);

      if (stopResult.success) {
        return {
          checkName,
          success: true,
          message: `Rolled back: stopped MySQL service "${serviceName}". System restored to pre-repair state.`,
          rollbackSupported: false,
        };
      }

      return {
        checkName,
        success: false,
        message: `Rollback failed: could not stop MySQL service "${serviceName}".`,
        detail: stopResult.stderr,
        rollbackSupported: false,
      };
    }

    return {
      checkName,
      success: false,
      message: `Rollback is not supported for "${checkName}".`,
      rollbackSupported: false,
    };
  }
}
