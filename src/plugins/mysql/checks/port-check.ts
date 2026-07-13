/**
 * MySQL Port Check
 *
 * Verifies if MySQL's configured port (typically 3306) is available or occupied.
 */

import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { getPortOwner } from '../../../infra/system/port-checker.js';

/**
 * Check if the port configured for MySQL is open or occupied.
 *
 * @param configuredPort - Port MySQL is configured to bind to (e.g. 3306)
 */
export async function checkMysqlPort(configuredPort: number): Promise<DiagnosticCheck> {
  const owner = await getPortOwner(configuredPort);

  if (!owner) {
    return {
      name: 'mysql-port',
      label: `MySQL Port Usage (Port ${configuredPort})`,
      status: 'pass',
      message: `Port ${configuredPort} is free and ready.`,
      detail:
        `No process is listening on TCP port ${configuredPort}.\n\n` +
        'When MySQL starts up, it must bind to this port to listen for incoming SQL ' +
        'connections. Since it is currently unoccupied, MySQL should have no port binding ' +
        'issues during startup.',
    };
  }

  const isMysql =
    owner.processName.toLowerCase().includes('mysql') ||
    owner.processName.toLowerCase().includes('mariadb');

  if (isMysql) {
    return {
      name: 'mysql-port',
      label: `MySQL Port Usage (Port ${configuredPort})`,
      status: 'pass',
      message: `Port ${configuredPort} is held by MySQL (PID: ${owner.pid}, ${owner.processName}).`,
      detail:
        `Port ${configuredPort} is active and occupied by process "${owner.processName}" ` +
        `running under Process ID (PID) ${owner.pid}. This is expected if your MySQL server ` +
        'is currently running and healthy.',
    };
  }

  return {
    name: 'mysql-port',
    label: `MySQL Port Usage (Port ${configuredPort})`,
    status: 'fail',
    message: `Port ${configuredPort} is occupied by another process: ${owner.processName} (PID: ${owner.pid}).`,
    detail:
      `TCP port ${configuredPort} is currently occupied by process "${owner.processName}" ` +
      `(PID ${owner.pid}), which is NOT MySQL.\n\n` +
      'Only one process can bind to a TCP port at a time. If another application (like ' +
      'an older/duplicate database, Apache, or a custom app) occupies this port, MySQL ' +
      'will crash on startup with a "bind address already in use" error.',
    suggestion:
      `Stop the process "${owner.processName}" using this port, or edit your my.ini ` +
      `configuration to bind MySQL to a different port (e.g., 3307).`,
  };
}
