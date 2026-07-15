/**
 * MySQL Permissions Check
 *
 * Verifies that the current user has appropriate access to MySQL's
 * data directory and that the process is running with the required
 * privileges for service management operations.
 *
 * What this teaches:
 * - Why database operations often require elevated privileges
 * - The difference between reading a file and writing to it
 * - How Windows UAC and Unix sudo relate to service management
 */

import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { checkElevation, checkFileAccess } from '../../../infra/system/permissions-checker.js';
import { parseConfigFile } from '../../../infra/system/config-parser.js';
import { MYSQL_CONFIG_PATHS_WINDOWS } from '../mysql-constants.js';

/** Common MySQL data directories to probe when no config is available */
const FALLBACK_DATA_DIRS = [
  'C:\\xampp\\mysql\\data',
  'C:\\ProgramData\\MySQL\\MySQL Server 8.0\\Data',
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\Data',
  '/var/lib/mysql',
  '/usr/local/var/mysql',
];

/**
 * Attempt to locate the MySQL data directory from config or well-known paths.
 */
async function resolveDataDir(): Promise<string | undefined> {
  for (const configPath of MYSQL_CONFIG_PATHS_WINDOWS) {
    try {
      const config = await parseConfigFile(configPath);
      const datadir = config?.mysqld?.datadir;
      if (datadir) return datadir;
    } catch {
      // try next
    }
  }

  for (const dir of FALLBACK_DATA_DIRS) {
    const access = checkFileAccess(dir);
    if (access.readable) return dir;
  }

  return undefined;
}

/**
 * Run the MySQL permissions check.
 */
export async function checkMysqlPermissions(): Promise<DiagnosticCheck> {
  const [elevation, dataDir] = await Promise.all([checkElevation(), resolveDataDir()]);

  // Build detail sections
  const elevationLine = elevation.isElevated
    ? '✓ Running with elevated privileges (admin/root).'
    : '✗ Running as a standard (non-elevated) user.';

  if (!dataDir) {
    // We can still report elevation status even without a data dir
    return {
      name: 'mysql-permissions',
      label: 'MySQL Permissions',
      status: elevation.isElevated ? 'pass' : 'warn',
      message: elevation.isElevated
        ? 'Elevated privileges confirmed. Data directory could not be located.'
        : 'Running without elevated privileges. Data directory could not be located.',
      detail:
        `${elevationLine}\n\n` +
        'MySQL requires write access to its data directory (typically C:\\ProgramData\\MySQL\\... ' +
        'on Windows or /var/lib/mysql on Linux) to create/modify databases. ' +
        'Dev Doctor could not locate the data directory on this machine, so file-level ' +
        'permissions could not be verified.\n\n' +
        'Service management commands (net start / systemctl) always require elevation.',
      suggestion: elevation.isElevated
        ? undefined
        : 'If you need to start/stop MySQL or repair service issues, re-run the terminal as Administrator (Windows) or use sudo (Linux/macOS).',
    };
  }

  const access = checkFileAccess(dataDir);

  const dataDirLine = access.writable
    ? `✓ Data directory is readable and writable: ${dataDir}`
    : access.readable
      ? `⚠ Data directory is readable but NOT writable: ${dataDir}`
      : `✗ Data directory is not accessible: ${dataDir}`;

  // Determine overall status
  let status: DiagnosticCheck['status'] = 'pass';
  if (!access.readable) {
    status = 'fail';
  } else if (!access.writable || !elevation.isElevated) {
    status = 'warn';
  }

  const message =
    status === 'pass'
      ? `Permissions look good. Elevated: ${elevation.isElevated ? 'yes' : 'no'}, data dir writable.`
      : status === 'warn'
        ? `Some permission constraints detected. Repairs may require elevation.`
        : `Cannot access MySQL data directory. Service repairs will likely fail.`;

  return {
    name: 'mysql-permissions',
    label: 'MySQL Permissions',
    status,
    message,
    detail:
      `${elevationLine}\n` +
      `${dataDirLine}\n\n` +
      'MySQL requires write access to its data directory to operate, and service ' +
      'management (start/stop) requires administrator privileges on Windows or root ' +
      'on Linux/macOS. Without elevation, `devdoctor fix mysql` may fail when ' +
      'attempting to start the MySQL80 service.',
    suggestion:
      status !== 'pass'
        ? process.platform === 'win32'
          ? 'Run the terminal as Administrator to enable service management repairs.'
          : 'Run with sudo to enable service management: sudo devdoctor fix mysql'
        : undefined,
  };
}
