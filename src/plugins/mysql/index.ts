import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import type { DiagnosticTask } from '../../core/types/diagnostic.js';
import type { ConfigCheckResult } from './checks/config-check.js';
import type { XamppProcessCheckResult } from './checks/xampp-process-check.js';
import { checkMysqlConfig } from './checks/config-check.js';
import { checkMysqlPort } from './checks/port-check.js';
import { checkMysqlService } from './checks/service-check.js';
import { checkMysqlLog } from './checks/log-check.js';
import { checkMysqlPermissions } from './checks/permissions-check.js';
import { checkXamppProcess } from './checks/xampp-process-check.js';
import { checkService } from '../../infra/system/service-checker.js';
import { runCommand, runElevatedCommand } from '../../infra/os/command-runner.js';
import { getPortOwner } from '../../infra/system/port-checker.js';
import { spawnDetached, findRunningProcess, waitForPort } from '../../infra/os/process-manager.js';
import {
  MYSQL_WINDOWS_SERVICES,
  MYSQL_UNIX_SERVICES,
  MYSQLD_PROCESS_NAME_WIN,
  MYSQLD_PROCESS_NAME_UNIX,
} from './mysql-constants.js';

// ── Helpers ───────────────────────────────────────────────────────

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

/**
 * Build a systemctl command that is elevation-aware (ADR-0009).
 *
 * On Unix:
 * - If already root (UID 0), skip sudo entirely.
 * - Otherwise, use `sudo -n` (non-interactive). This fails fast with a clear
 *   error rather than hanging for a password prompt when no TTY is available.
 *
 * @param action      - systemctl subcommand (e.g. "start", "stop")
 * @param serviceName - the service to act on
 */
async function runSystemctl(
  action: string,
  serviceName: string,
): Promise<ReturnType<typeof runCommand>> {
  // On root we can call systemctl directly
  const isRoot =
    typeof process.getuid === 'function' && process.getuid() === 0;

  if (isRoot) {
    return runCommand('systemctl', [action, serviceName]);
  }

  // `sudo -n` exits immediately with an error if a password would be required,
  // which prevents indefinite hangs in non-interactive terminals.
  const result = await runCommand('sudo', ['-n', 'systemctl', action, serviceName]);

  if (!result.success && (result.stderr.includes('password') || result.stderr.includes('sudo'))) {
    // Return a friendlier error message for the common "needs password" case
    return {
      ...result,
      stderr:
        `Elevation required: re-run with sudo or as root.\n` +
        `Original error: ${result.stderr}`,
    };
  }

  return result;
}

// ── Plugin ────────────────────────────────────────────────────────

export class MysqlPlugin implements Plugin {
  readonly name = 'mysql';
  readonly displayName = 'MySQL';
  readonly description = 'Diagnoses your MySQL local database environment.';
  readonly projectMarkers = ['docker-compose.yml', 'docker-compose.yaml', '.env', 'my.cnf', 'my.ini'];

  /**
   * Cached results from the most recent diagnose() call.
   * repair() and verify() reuse these to avoid redundant disk/process reads.
   */
  private lastConfig: ConfigCheckResult | undefined;
  private lastXamppCheck: XamppProcessCheckResult | undefined;

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    let port = 3306;
    let logErrorPath: string | undefined = undefined;

    const tasks: DiagnosticTask[] = [
      {
        name: 'mysql-config',
        label: 'MySQL Configuration',
        run: async () => {
          const res = await checkMysqlConfig();
          this.lastConfig = res;
          port = res.port;
          logErrorPath = res.logErrorPath;
          return res.check;
        },
      },
      {
        name: 'mysql-service',
        label: 'MySQL Service',
        run: checkMysqlService,
      },
      {
        name: 'mysql-port',
        label: 'MySQL Port',
        dependsOn: ['mysql-config'],
        run: () => checkMysqlPort(port),
      },
      {
        name: 'mysql-log',
        label: 'MySQL Error Log',
        dependsOn: ['mysql-config'],
        run: () => checkMysqlLog(logErrorPath),
      },
      {
        name: 'mysql-permissions',
        label: 'MySQL Permissions',
        run: checkMysqlPermissions,
      },
      {
        name: 'xampp-process',
        label: 'XAMPP Process',
        run: async () => {
          const res = await checkXamppProcess();
          this.lastXamppCheck = res;
          return res.check;
        },
      },
    ];

    let checks = await runDiagnosticTasks(tasks);

    // Only include the XAMPP process check when no service was found.
    // When a service is present, the service check already covers process status
    // and showing both would be redundant and confusing.
    const serviceCheck = checks.find((c) => c.name === 'mysql-service');
    if (serviceCheck && !(serviceCheck.status === 'warn' && serviceCheck.message.includes('No registered'))) {
      checks = checks.filter((c) => c.name !== 'xampp-process');
    }

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

      let startResult = isWindows
        ? await runCommand('net', ['start', serviceName])
        : await runSystemctl('start', serviceName);  // ADR-0009: elevation-aware

      const needElevation =
        !startResult.success &&
        (startResult.stderr.includes('System error 5') ||
         startResult.exitCode === 5 ||
         startResult.stderr.includes('Elevation required'));

      if (needElevation) {
        startResult = isWindows
          ? await runElevatedCommand('net', ['start', serviceName])
          : await runElevatedCommand('systemctl', ['start', serviceName]);
      }

      if (startResult.success) {
        return {
          checkName,
          success: true,
          message: `Successfully started MySQL service "${serviceName}".`,
          detail: startResult.stdout,
          rollbackSupported: true,
        };
      }

      return {
        checkName,
        success: false,
        message: `Failed to start MySQL service "${serviceName}".`,
        detail: startResult.stderr || 'Action cancelled or access denied.',
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

      // ADR-0009: Probe TCP port instead of fixed sleep.
      // waitForPort polls the configured port until mysqld accepts connections
      // or 10 seconds elapse — whichever comes first.
      const config = this.lastConfig ?? (await checkMysqlConfig());
      const portReady = await waitForPort(config.port, '127.0.0.1', 10_000);

      if (!portReady) {
        return {
          checkName,
          success: false,
          message:
            `MySQL process was spawned (PID: ${result.pid ?? 'unknown'}) but did not ` +
            `become reachable on port ${config.port} within 10 seconds.`,
          detail:
            'mysqld may have failed to start. Check the MySQL error log for details.\n' +
            `Spawned: ${mysqldPath}${configArgs.length ? ` ${configArgs[0]}` : ''}`,
          rollbackSupported: true,
        };
      }

      return {
        checkName,
        success: true,
        message: `MySQL process started and accepting connections (PID: ${result.pid ?? 'unknown'}).`,
        detail: `Spawned: ${mysqldPath}${configArgs.length ? ` ${configArgs[0]}` : ''}`,
        // We can kill the process we just started if verification fails
        rollbackSupported: true,
      };
    }

    // ── mysql-port ──
    if (checkName === 'mysql-port') {
      const config = this.lastConfig ?? (await checkMysqlConfig());

      // ADR-0009: Read the owner at repair time and cross-check before killing.
      const owner = await getPortOwner(config.port);

      if (!owner) {
        return {
          checkName,
          success: true,
          message: `Port ${config.port} is already free. No repair needed.`,
          rollbackSupported: false,
        };
      }

      // Re-read the owner immediately before issuing the kill to mitigate PID recycling.
      // If the PID or process name changed between diagnosis and now, abort.
      const ownerNow = await getPortOwner(config.port);

      if (!ownerNow) {
        return {
          checkName,
          success: true,
          message: `Port ${config.port} became free before the repair ran. No action needed.`,
          rollbackSupported: false,
        };
      }

      if (ownerNow.pid !== owner.pid || ownerNow.processName !== owner.processName) {
        return {
          checkName,
          success: false,
          message:
            `Port ${config.port} owner changed between diagnosis and repair ` +
            `(was PID ${owner.pid} "${owner.processName}", now PID ${ownerNow.pid} "${ownerNow.processName}"). ` +
            `Aborting to prevent killing the wrong process.`,
          rollbackSupported: false,
        };
      }

      const killResult = isWindows
        ? await runCommand('taskkill', ['/f', '/pid', String(ownerNow.pid)])
        : await runCommand('kill', ['-9', String(ownerNow.pid)]);

      if (killResult.success) {
        return {
          checkName,
          success: true,
          message: `Terminated conflicting process "${ownerNow.processName}" (PID: ${ownerNow.pid}) on port ${config.port}.`,
          detail: killResult.stdout,
          rollbackSupported: false,
        };
      }

      return {
        checkName,
        success: false,
        message: `Failed to terminate "${ownerNow.processName}" (PID: ${ownerNow.pid}) on port ${config.port}.`,
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

      let stopResult = isWindows
        ? await runCommand('net', ['stop', serviceName])
        : await runSystemctl('stop', serviceName); // ADR-0009: elevation-aware

      if (!stopResult.success && (stopResult.stderr.includes('System error 5') || stopResult.exitCode === 5)) {
        stopResult = isWindows
          ? await runElevatedCommand('net', ['stop', serviceName])
          : await runElevatedCommand('systemctl', ['stop', serviceName]);
      }

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
      let killResult = isWindows
        ? await runCommand('taskkill', ['/f', '/pid', String(pid)])
        : await runCommand('kill', ['-9', String(pid)]);

      if (!killResult.success && killResult.stderr.includes('Access is denied')) {
        killResult = isWindows
          ? await runElevatedCommand('taskkill', ['/f', '/pid', String(pid)])
          : await runElevatedCommand('kill', ['-9', String(pid)]);
      }

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
