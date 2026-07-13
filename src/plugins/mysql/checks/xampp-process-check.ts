/**
 * XAMPP MySQL Process Check
 *
 * Detects whether MySQL is running as a background process (mysqld.exe / mysqld)
 * rather than as a registered system service. This is the default for XAMPP
 * installations that don't register a Windows service.
 *
 * Why a separate check?
 * The service-check.ts queries Windows Services via `sc query`. XAMPP's default
 * install doesn't register a service — it just runs mysqld.exe as a child of
 * the XAMPP Control Panel. These are invisible to `sc query`, so service-check
 * correctly reports "no service found" (warn). This check fills that gap by
 * looking for the process directly and locating the binary for repair.
 *
 * What this teaches:
 * - The difference between a Windows Service and a plain background process
 * - How mysqld.exe works as a standalone daemon
 * - Process detection vs service detection
 * - Why `tasklist` is used here rather than `sc query`
 */

import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { findRunningProcess } from '../../../infra/os/process-manager.js';
import {
  MYSQL_CONFIG_PATHS_WINDOWS,
  XAMPP_MYSQLD_FALLBACK_PATHS,
  MYSQLD_PROCESS_NAME_WIN,
  MYSQLD_PROCESS_NAME_UNIX,
} from '../mysql-constants.js';
import { parseConfigFile } from '../../../infra/system/config-parser.js';

// ── Binary resolution ─────────────────────────────────────────────

/**
 * Attempt to locate the mysqld executable path.
 *
 * Resolution order:
 * 1. basedir from my.ini → append bin/mysqld.exe
 * 2. The directory containing my.ini → append mysqld.exe (common for XAMPP)
 * 3. Well-known XAMPP fallback paths
 *
 * Returns undefined if the binary cannot be found on disk.
 *
 * @param existsSync - Injectable for testing (defaults to fs.existsSync)
 */
export async function resolveMysqldPath(
  existsSync: (p: string) => boolean = fs.existsSync,
): Promise<string | undefined> {
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'mysqld.exe' : 'mysqld';

  // 1. Try deriving from config files
  for (const configPath of MYSQL_CONFIG_PATHS_WINDOWS) {
    if (!existsSync(configPath)) continue;

    try {
      const config = await parseConfigFile(configPath);
      const basedir: string | undefined = config?.mysqld?.basedir;

      if (basedir) {
        const candidate = path.join(basedir, 'bin', binaryName);
        if (existsSync(candidate)) return candidate;
      }

      // Also try the same directory as my.ini (XAMPP places both there)
      const sameDir = path.join(path.dirname(configPath), binaryName);
      if (existsSync(sameDir)) return sameDir;
    } catch {
      // Try next config
    }
  }

  // 2. Well-known XAMPP paths (Windows only)
  if (isWindows) {
    for (const p of XAMPP_MYSQLD_FALLBACK_PATHS) {
      if (existsSync(p)) return p;
    }
  }

  return undefined;
}

// ── Check ─────────────────────────────────────────────────────────

export interface XamppProcessCheckResult {
  check: DiagnosticCheck;
  /** Absolute path to mysqld binary, if found */
  mysqldPath?: string;
  /** PIDs of running mysqld processes */
  runningPids: number[];
}

/**
 * Check whether MySQL is running as a plain process (non-service mode).
 *
 * This check is complementary to service-check.ts:
 * - service-check detects MySQL running as a Windows/Unix service
 * - xampp-process-check detects MySQL running as a plain background process
 *
 * Only one of these will find MySQL in a given installation:
 * - XAMPP default install → no service, plain process → this check fires
 * - MySQL standalone install with service → service-check fires
 *
 * @param existsSync - Injectable for testing (defaults to fs.existsSync)
 */
export async function checkXamppProcess(
  existsSync: (p: string) => boolean = fs.existsSync,
): Promise<XamppProcessCheckResult> {
  const isWindows = process.platform === 'win32';
  const processName = isWindows ? MYSQLD_PROCESS_NAME_WIN : MYSQLD_PROCESS_NAME_UNIX;

  // Run process detection and binary resolution concurrently
  const [processInfo, mysqldPath] = await Promise.all([
    findRunningProcess(processName),
    resolveMysqldPath(existsSync),
  ]);

  // ── Already running ──
  if (processInfo.running) {
    return {
      check: {
        name: 'xampp-process',
        label: 'MySQL Process (Non-Service)',
        status: 'pass',
        message: `mysqld is running as a background process (PID${processInfo.pids.length > 1 ? 's' : ''}: ${processInfo.pids.join(', ')}).`,
        detail:
          `MySQL is running outside of the Windows Service Manager — started directly ` +
          `as ${processName}. This is the standard mode for XAMPP and WampServer installations.\n\n` +
          `This check is complementary to the service check. If the service check shows ` +
          `"no service found", that is expected in this configuration.`,
      },
      mysqldPath,
      runningPids: processInfo.pids,
    };
  }

  // ── Not running but binary found — can repair ──
  if (mysqldPath) {
    return {
      check: {
        name: 'xampp-process',
        label: 'MySQL Process (Non-Service)',
        status: 'fail',
        message: `MySQL is not running. Binary found at: ${mysqldPath}`,
        detail:
          `No ${processName} process was detected, but the MySQL binary exists at:\n` +
          `  ${mysqldPath}\n\n` +
          `MySQL is not running as a Windows Service in this installation (typical for XAMPP). ` +
          `It must be started as a standalone process.\n\n` +
          `Dev Doctor can start it automatically by running mysqld with the ` +
          `--defaults-file flag pointing to my.ini.`,
        suggestion:
          isWindows
            ? `Run: devdoctor fix mysql  (will start ${mysqldPath} as a background process)\n` +
              `Or: Open the XAMPP Control Panel and click "Start" next to MySQL.`
            : `Run: sudo ${mysqldPath} --user=mysql`,
      },
      mysqldPath,
      runningPids: [],
    };
  }

  // ── Not running and binary not found ──
  return {
    check: {
      name: 'xampp-process',
      label: 'MySQL Process (Non-Service)',
      status: 'warn',
      message: 'MySQL is not running and the mysqld binary could not be located.',
      detail:
        `No running ${processName} process was detected and Dev Doctor could not find ` +
        `the MySQL binary in any standard XAMPP location.\n\n` +
        `If MySQL is installed via XAMPP, the binary should be at:\n` +
        `  C:\\xampp\\mysql\\bin\\mysqld.exe\n\n` +
        `If you are using a non-standard installation path, you may need to start ` +
        `MySQL manually.`,
      suggestion:
        'Open the XAMPP Control Panel and click "Start" next to MySQL, or verify ' +
        'your XAMPP installation is not corrupted.',
    },
    mysqldPath: undefined,
    runningPids: [],
  };
}
