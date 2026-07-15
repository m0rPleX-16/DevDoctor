/**
 * MySQL Error Log Check
 *
 * Scans the MySQL error log (.err file) for server crashes and connection faults.
 */

import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { scanLogFile } from '../../../infra/system/log-scanner.js';

/**
 * Scan MySQL error log file for issues.
 *
 * @param logErrorPath - Absolute path to the error log configured in my.ini
 */
export async function checkMysqlLog(logErrorPath?: string): Promise<DiagnosticCheck> {
  if (!logErrorPath) {
    return {
      name: 'mysql-log',
      label: 'MySQL Error Log Analysis',
      status: 'skip',
      message: 'No error log path is configured or auto-detected.',
      detail:
        'MySQL logs warnings and critical start/stop errors in a dedicated file. ' +
        'Since we could not locate the error log path (log-error not defined in config, ' +
        'and default directories do not exist), we cannot check for server logs.',
    };
  }

  const result = await scanLogFile(logErrorPath, {
    maxLines: 50,
    errorKeywords: ['[ERROR]', 'Fatal', 'Aborting', 'failed'],
  });

  if (!result.exists) {
    return {
      name: 'mysql-log',
      label: 'MySQL Error Log Analysis',
      status: 'warn',
      message: `Error log file does not exist at path: ${logErrorPath}`,
      detail:
        `The log path is configured as ${logErrorPath}, but no file exists at this path.\n\n` +
        'This is normal if the server has never run or if logs are redirected. However, ' +
        'it prevents Dev Doctor from reading server logs to help diagnose startup crashes.',
    };
  }

  if (result.matchedErrors.length === 0) {
    return {
      name: 'mysql-log',
      label: 'MySQL Error Log Analysis',
      status: 'pass',
      message: 'No critical errors detected in the error log.',
      detail:
        `Log file verified at: ${logErrorPath} (${result.totalLines} lines).\n\n` +
        'A scan of the recent log entries found no instances of critical failure terms ' +
        '("[ERROR]", "Fatal", or "Aborting"). This indicates a clean shutdown or run history.',
    };
  }

  // Format error list for display
  const errorSnippet = result.matchedErrors.map((line) => `  - ${line}`).join('\n');

  return {
    name: 'mysql-log',
    label: 'MySQL Error Log Analysis',
    status: 'warn',
    message: `Found ${result.matchedErrors.length} recent error(s) in log.`,
    detail:
      `Log file verified at: ${logErrorPath}\n\n` +
      `Recent error logs extracted:\n` +
      `${errorSnippet}\n\n` +
      `Check these lines to identify if they correspond to database crashes or ` +
      `missing storage tables.`,
    suggestion: `Open the error log file at "${logErrorPath}" to inspect full stack traces and context.`,
  };
}
