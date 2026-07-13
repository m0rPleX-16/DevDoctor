/**
 * MySQL Configuration Check
 *
 * Locates and validates MySQL's configuration file (my.ini / my.cnf).
 */

import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { parseConfigFile } from '../../../infra/system/config-parser.js';

// Common paths where MySQL config could be located on Windows
const COMMON_CONFIG_PATHS = [
  'C:\\xampp\\mysql\\bin\\my.ini',
  'C:\\ProgramData\\MySQL\\MySQL Server 8.0\\my.ini',
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\my.ini',
  'C:\\Program Files\\MySQL\\MySQL Server 8.4\\my.ini',
  'C:\\Program Files\\MySQL\\MySQL Server 9.0\\my.ini',
  'C:\\tools\\mysql\\my.ini',
];

export interface ConfigCheckResult {
  check: DiagnosticCheck;
  filePath?: string;
  parsedConfig?: Record<string, any>;
  port: number;
  logErrorPath?: string;
}

/**
 * Searches for and parses MySQL configuration file.
 */
export async function checkMysqlConfig(): Promise<ConfigCheckResult> {
  let foundPath: string | undefined;

  // 1. Check common locations
  for (const p of COMMON_CONFIG_PATHS) {
    if (fs.existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  // 2. Check WampServer paths dynamically if wamp directory exists
  if (!foundPath && fs.existsSync('C:\\wamp64\\bin\\mysql')) {
    try {
      const mysqlDirs = fs.readdirSync('C:\\wamp64\\bin\\mysql');
      for (const dir of mysqlDirs) {
        const p = path.join('C:\\wamp64\\bin\\mysql', dir, 'my.ini');
        if (fs.existsSync(p)) {
          foundPath = p;
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!foundPath) {
    return {
      check: {
        name: 'mysql-config',
        label: 'MySQL Configuration',
        status: 'warn',
        message: 'Could not locate MySQL configuration file (my.ini / my.cnf).',
        detail:
          'MySQL uses a configuration file (typically my.ini on Windows or my.cnf on Unix) ' +
          'to configure server options such as port allocation, directories, and error logs. ' +
          'If you run MySQL via a non-standard package or portable install, you must specify ' +
          'its location.',
        suggestion:
          'Make sure MySQL is installed. If using a portable stack, configure it ' +
          'such that my.ini resides in the binary folder or ProgramData.',
      },
      port: 3306, // Fallback default
    };
  }

  const config = await parseConfigFile(foundPath);
  const mysqldSection = config.mysqld ?? {};

  // Extract port configuration
  let port = 3306;
  if (mysqldSection.port) {
    const parsedPort = parseInt(mysqldSection.port, 10);
    if (!isNaN(parsedPort)) {
      port = parsedPort;
    }
  }

  // Extract log-error path
  let logErrorPath: string | undefined = mysqldSection['log-error'];
  if (logErrorPath) {
    // If it's a relative path, resolve it relative to config file directory
    if (!path.isAbsolute(logErrorPath)) {
      // Often in mysql/data/
      logErrorPath = path.resolve(path.dirname(foundPath), logErrorPath);
    }
  } else {
    // Try standard fallback log locations relative to my.ini
    const hostName = process.env.COMPUTERNAME ?? 'mysql';
    const fallbackLog = path.resolve(path.dirname(foundPath), '..', 'data', `${hostName}.err`);
    if (fs.existsSync(fallbackLog)) {
      logErrorPath = fallbackLog;
    }
  }

  return {
    check: {
      name: 'mysql-config',
      label: 'MySQL Configuration',
      status: 'pass',
      message: `MySQL config found at: ${foundPath}`,
      detail:
        `Found active configuration at ${foundPath}.\n\n` +
        `Parsed parameters:\n` +
        `  - Port: ${port}\n` +
        `  - Base dir: ${mysqldSection.basedir ?? 'default'}\n` +
        `  - Data dir: ${mysqldSection.datadir ?? 'default'}\n` +
        `  - Error Log: ${logErrorPath ?? 'not configured'}`,
    },
    filePath: foundPath,
    parsedConfig: config,
    port,
    logErrorPath,
  };
}
