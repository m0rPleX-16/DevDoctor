import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, CheckStatus } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import type { ConfigCheckResult } from './checks/config-check.js';
import type { XamppProcessCheckResult } from './checks/xampp-process-check.js';
import { checkMysqlConfig } from './checks/config-check.js';
import { checkMysqlPort } from './checks/port-check.js';
import { checkMysqlService } from './checks/service-check.js';
import { checkMysqlLog } from './checks/log-check.js';
import { checkMysqlPermissions } from './checks/permissions-check.js';
import { checkXamppProcess } from './checks/xampp-process-check.js';
import { checkService } from '../../infra/system/service-checker.js';
import { runCommand } from '../../infra/os/command-runner.js';
import { getPortOwner } from '../../infra/system/port-checker.js';
import { spawnDetached, findRunningProcess } from '../../infra/os/process-manager.js';
import {
  MYSQL_WINDOWS_SERVICES,
  MYSQL_UNIX_SERVICES,
  MYSQLD_PROCESS_NAME_WIN,
  MYSQLD_PROCESS_NAME_UNIX,
} from './mysql-constants.js';

// ── Helpers ───────────────────────────────────────────────────────

function deriveOverallStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.includes('skip')) return 'skip';
  return 'pass';
}

/**
 * Resolve the first installed MySQL service name from the candidate list.
 * Returns undefined when MySQL is installed in non-service mode (e.g. XAMPP default).
 */
async function resolveInstalledServiceName(): Promise<string | undefined> {
  const isWindows = process.platform === 'win32';
  const candidates = isWindows ? MYSQL_WINDOWS_SERVICES : MYSQL_UNIX_SERVICES;
  for (const name of candidates) {
    const info = await checkService(name);
    if (info.status !== 'not_installed') return name;
  }
  return undefined;
}

// ── Plugin ────────────────────────────────────────────────────────

export class MysqlPlugin implements Plugin {
  readonly name = 'mysql';
  readonly displayName = 'MySQL';
  readonly description = 'Diagnoses your MySQL local database environment.';

  /**
   * Cached results from the most recent diagnose() call.
   * repair() and verify() reuse these to avoid redundant disk/process reads.
   */
  private lastConfig: ConfigCheckResult | undefined;
  private lastXamppCheck: XamppProcessCheckResult | undefined;

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    // Config must run first — downstream checks use port and log path
    const configResult = await checkMysqlConfig();
    this.lastConfig = configResult;

    const [serviceCheck, portCheck, logCheck, permissionsCheck, xamppResult] =
      await Promise.all([
        checkMysqlService(),
        checkMysqlPort(configResult.port),
        checkMysqlLog(configResult.logErrorPath),
        checkMysqlPermissions(),
        checkXamppProcess(),
      ]);

    this.lastXamppCheck = xamppResult;

    // Only include the XAMPP process check when no service was found.
    // When a service is present, the service check already covers process status
    // and showing both would be redundant and confusing.
    const checks =
      serviceCheck.status === 'warn' && serviceCheck.message.includes('No registered')
        ? [configResult.check, serviceCheck, portCheck, logCheck, permissionsCheck, xamppResult.check]
        : [configResult.check, serviceCheck, portCheck, logCheck, permissionsCheck];

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

    // ── mysql-service ──
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

    // ── xampp-process ──
    if (checkName === 'xampp-process') {
      // Use cached XAMPP check result — it already contains the binary path
      const cached = this.lastXamppCheck;
      const mysqldPath = cached?.mysqldPath;

      if (!mysqldPath) {
        return {
          checkName,
          success: false,
          message:
            'Cannot start MySQL: mysqld binary path is unknown. ' +
            'Use the XAMPP Control Panel to start MySQL manually.',
          rollbackSupported: false,
        };
      }

      // Resolve the my.ini path from the binary's directory
      // mysqld.exe lives in <basedir>/bin/, my.ini in the same folder
      const configPath = path.join(path.dirname(mysqldPath), 'my.ini');
      const configArgs = fs.existsSync(configPath)
        ? [`--defaults-file=${configPath}`]
        : [];

      // Spawn mysqld as a detached background process.
      // This is exactly what the XAMPP Control Panel does internally.
      const result = spawnDetached(mysqldPath, configArgs, path.dirname(mysqldPath));

      if (!result.spawned) {
        return {
          checkName,
          success: false,
          message: 'Failed to spawn mysqld process.',
          detail: result.error,
          rollbackSupported: false,
        };
      }

      // Give the process a moment to initialise before verification
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return {
        checkName,
        success: true,
        message: `MySQL process started (PID: ${result.pid ?? 'unknown'}).`,
        detail: `Spawned: ${mysqldPath}${configArgs.length ? ` ${configArgs[0]}` : ''}`,
        // We can kill the process we just started if verification fails
        rollbackSupported: true,
      };
    }

    // ── mysql-port ──
    if (checkName === 'mysql-port') {
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

    if (checkName === 'xampp-process') {
      const processName = isWindows ? MYSQLD_PROCESS_NAME_WIN : MYSQLD_PROCESS_NAME_UNIX;
      const info = await findRunningProcess(processName);
      return {
        checkName,
        success: info.running,
        message: info.running
          ? `MySQL process is running (PID${info.pids.length > 1 ? 's' : ''}: ${info.pids.join(', ')}).`
          : 'MySQL process is not running.',
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

      return stopResult.success
        ? {
            checkName,
            success: true,
            message: `Rolled back: stopped MySQL service "${serviceName}".`,
            rollbackSupported: false,
          }
        : {
            checkName,
            success: false,
            message: `Rollback failed: could not stop MySQL service "${serviceName}".`,
            detail: stopResult.stderr,
            rollbackSupported: false,
          };
    }

    if (checkName === 'xampp-process') {
      // Kill the mysqld process we just started
      const processName = isWindows ? MYSQLD_PROCESS_NAME_WIN : MYSQLD_PROCESS_NAME_UNIX;
      const info = await findRunningProcess(processName);

      if (!info.running || info.pids.length === 0) {
        return {
          checkName,
          success: true,
          message: 'MySQL process is not running — nothing to roll back.',
          rollbackSupported: false,
        };
      }

      // Kill the most recently spawned PID (last in list)
      const pid = info.pids[info.pids.length - 1];
      const killResult = isWindows
        ? await runCommand('taskkill', ['/f', '/pid', String(pid)])
        : await runCommand('kill', ['-9', String(pid)]);

      return killResult.success
        ? {
            checkName,
            success: true,
            message: `Rolled back: stopped MySQL process (PID: ${pid}).`,
            rollbackSupported: false,
          }
        : {
            checkName,
            success: false,
            message: `Rollback failed: could not kill MySQL process (PID: ${pid}).`,
            detail: killResult.stderr,
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

  canRepair(checkName: string): boolean {
    return (
      checkName === 'mysql-service' ||
      checkName === 'mysql-port' ||
      checkName === 'xampp-process'
    );
  }
}
