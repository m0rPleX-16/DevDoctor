/**
 * MySQL Plugin
 *
 * Implements the Plugin interface for MySQL diagnostics.
 */

import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, CheckStatus } from '../../core/types/diagnostic.js';
import { checkMysqlConfig } from './checks/config-check.js';
import { checkMysqlPort } from './checks/port-check.js';
import { checkMysqlService } from './checks/service-check.js';
import { checkMysqlLog } from './checks/log-check.js';

function deriveOverallStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.includes('skip')) return 'skip';
  return 'pass';
}

export class MysqlPlugin implements Plugin {
  readonly name = 'mysql';
  readonly displayName = 'MySQL';
  readonly description = 'Diagnoses your MySQL local database environment.';

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    // 1. Run config check first to extract custom port and error log path
    const configResult = await checkMysqlConfig();

    // 2. Run other checks in parallel using configuration metadata
    const [serviceCheck, portCheck, logCheck] = await Promise.all([
      checkMysqlService(),
      checkMysqlPort(configResult.port),
      checkMysqlLog(configResult.logErrorPath),
    ]);

    const checks = [configResult.check, serviceCheck, portCheck, logCheck];
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
}
