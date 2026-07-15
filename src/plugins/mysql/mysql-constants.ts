/**
 * MySQL Plugin Constants
 *
 * Shared constants used across the MySQL plugin's checks, repairs, and
 * verifications. Centralising them here means a single place to update
 * when a new service name or config path needs to be supported.
 *
 * Architecture note:
 * These constants live inside the plugin layer — they are MySQL-specific
 * knowledge and must never leak into the Core or Infrastructure layers.
 */

/** System service names to probe on Windows, in priority order. */
export const MYSQL_WINDOWS_SERVICES = [
  'MySQL90',
  'MySQL80',
  'MySQL',
  'xamppmysql',
  'wampmysqld',
] as const;

/** System service names to probe on Unix, in priority order. */
export const MYSQL_UNIX_SERVICES = ['mysql', 'mariadb'] as const;

/** Default MySQL port when no configuration file can be found. */
export const MYSQL_DEFAULT_PORT = 3306;

/** Common locations for my.ini / my.cnf on Windows. */
export const MYSQL_CONFIG_PATHS_WINDOWS = [
  'C:\\xampp\\mysql\\bin\\my.ini',
  'C:\\ProgramData\\MySQL\\MySQL Server 9.0\\my.ini',
  'C:\\ProgramData\\MySQL\\MySQL Server 8.0\\my.ini',
  'C:\\Program Files\\MySQL\\MySQL Server 9.0\\my.ini',
  'C:\\Program Files\\MySQL\\MySQL Server 8.4\\my.ini',
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\my.ini',
  'C:\\tools\\mysql\\my.ini',
] as const;

/** Common locations for my.cnf on Unix/macOS systems. */
export const MYSQL_CONFIG_PATHS_UNIX = [
  '/etc/mysql/my.cnf',
  '/etc/my.cnf',
  '/etc/mysql/mysql.conf.d/mysqld.cnf',
  '/usr/local/etc/my.cnf', // macOS Homebrew (Intel)
  '/opt/homebrew/etc/my.cnf', // macOS Homebrew (Apple Silicon)
  '~/.my.cnf',
] as const;

/**
 * Well-known XAMPP MySQL binary locations.
 * Used when basedir is not set in my.ini.
 */
export const XAMPP_MYSQLD_FALLBACK_PATHS = [
  'C:\\xampp\\mysql\\bin\\mysqld.exe',
  'C:\\xampp64\\mysql\\bin\\mysqld.exe',
] as const;

/**
 * The mysqld.exe process name as seen in Windows tasklist output.
 * MySQL standalone and XAMPP both use this executable name.
 */
export const MYSQLD_PROCESS_NAME_WIN = 'mysqld.exe';

/**
 * The mysqld process name on Unix.
 */
export const MYSQLD_PROCESS_NAME_UNIX = 'mysqld';
