/**
 * Node.js Plugin
 *
 * The first plugin for Dev Doctor — serves as the proof of concept
 * for the entire plugin architecture.
 *
 * This plugin diagnoses the Node.js development environment by running
 * several checks: Node.js installation, npm availability, and PATH
 * configuration.
 *
 * Architecture note:
 * This is a concrete implementation of the Plugin interface.
 * It lives in the Plugins layer, which depends on Core (for types)
 * and Infrastructure (for command execution).
 * The Core layer never references this file directly — it only
 * knows about the Plugin interface.
 */

import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, CheckStatus } from '../../core/types/diagnostic.js';
import { checkNodeVersion } from './checks/version-check.js';
import { checkNpm } from './checks/npm-check.js';
import { checkNodePath } from './checks/path-check.js';

/**
 * Determine the overall status from a list of individual check statuses.
 * The overall status is the "worst" status found.
 *
 * Priority: fail > warn > skip > pass
 */
function deriveOverallStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.includes('skip')) return 'skip';
  return 'pass';
}

/**
 * Node.js Plugin
 *
 * Checks:
 * 1. Node.js installation and version
 * 2. npm installation and version
 * 3. PATH configuration
 */
export class NodePlugin implements Plugin {
  readonly name = 'node';
  readonly displayName = 'Node.js';
  readonly description = 'Diagnoses your Node.js development environment.';

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    // Run all checks concurrently — they're independent of each other
    const checks = await Promise.all([
      checkNodeVersion(),
      checkNpm(),
      checkNodePath(),
    ]);

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
