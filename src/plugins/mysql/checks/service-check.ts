/**
 * MySQL Service Check
 *
 * Verifies system service status for MySQL (e.g. MySQL80, xamppmysql, mysql).
 */

import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { checkService } from '../../../infra/system/service-checker.js';
import { MYSQL_WINDOWS_SERVICES, MYSQL_UNIX_SERVICES } from '../mysql-constants.js';

/**
 * Checks system service status for MySQL.
 */
export async function checkMysqlService(): Promise<DiagnosticCheck> {
  const isWindows = process.platform === 'win32';
  const candidateServices = isWindows ? MYSQL_WINDOWS_SERVICES : MYSQL_UNIX_SERVICES;

  let installedService: { name: string; status: string; pid?: number } | undefined;

  for (const serviceName of candidateServices) {
    const serviceInfo = await checkService(serviceName);
    if (serviceInfo.status !== 'not_installed') {
      installedService = serviceInfo;
      break;
    }
  }

  if (!installedService) {
    return {
      name: 'mysql-service',
      label: 'MySQL System Service',
      status: 'warn',
      message: 'No registered MySQL system service was found.',
      detail:
        'A system service allows the MySQL database to run silently in the background ' +
        'and start automatically when the OS boots. While you can run MySQL manually via ' +
        'the command line (using mysqld.exe), a background service is the standard ' +
        'production config on Windows (MySQL80) and Unix (mysql/mariadb).',
      suggestion:
        'If you expect MySQL to run as a service, verify the installation. If using XAMPP ' +
        'or a local portable folder, start the database manually via the XAMPP Control Panel ' +
        'or mysql\\bin\\mysqld.exe.',
    };
  }

  if (installedService.status === 'running') {
    return {
      name: 'mysql-service',
      label: 'MySQL System Service',
      status: 'pass',
      message: `MySQL service "${installedService.name}" is running (PID: ${installedService.pid ?? 'Unknown'}).`,
      detail:
        `The background system service "${installedService.name}" was found and is currently ` +
        `active (RUNNING). A background process PID of ${installedService.pid ?? 'Unknown'} ` +
        `is managing connection requests.`,
    };
  }

  if (installedService.status === 'stopped') {
    return {
      name: 'mysql-service',
      label: 'MySQL System Service',
      status: 'fail',
      message: `MySQL service "${installedService.name}" is installed but currently STOPPED.`,
      detail:
        `The service "${installedService.name}" exists but is not running. External clients ` +
        'will not be able to establish database connections until the service is started.',
      suggestion:
        isWindows
          ? `Open Services (services.msc), find "${installedService.name}", and click "Start". ` +
            `Alternatively, run: net start ${installedService.name} (requires admin privileges).`
          : `Start the service running: sudo systemctl start ${installedService.name}`,
    };
  }

  return {
    name: 'mysql-service',
    label: 'MySQL System Service',
    status: 'warn',
    message: `MySQL service "${installedService.name}" status is unknown.`,
    detail: `The system service exists, but we encountered an error query status.`,
  };
}
