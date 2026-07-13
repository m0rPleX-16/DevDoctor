/**
 * Python Plugin
 *
 * Diagnoses a Python development environment.
 *
 * Checks (in dependency order):
 *   1. python-installation — python3/python binary present and version ≥ 3
 *   2. python-pip          — pip3/pip available (depends on #1)
 *   3. python-venv         — active virtual environment detected (depends on #1)
 *   4. python-path         — PATH ordering / multiple Python conflict (depends on #1)
 *
 * Repair support:
 *   Python environment repairs (install, PATH reordering) require platform-specific
 *   steps that are risky to automate. The plugin surfaces precise, actionable
 *   suggestions rather than attempting automated repairs.
 */

import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus, applyDependencySkips } from '../../core/engine/status-utils.js';
import { checkPythonInstallation } from './checks/installation-check.js';
import { checkPip } from './checks/pip-check.js';
import { checkPythonVenv } from './checks/venv-check.js';
import { checkPythonPath } from './checks/path-check.js';

export class PythonPlugin implements Plugin {
  readonly name = 'python';
  readonly displayName = 'Python';
  readonly description = 'Diagnoses your Python development environment.';

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    // Step 1: resolve the Python executable — downstream checks need the command name
    const installInfo = await checkPythonInstallation();

    // Steps 2-4: run concurrently — all declare dependsOn python-installation
    const [pipCheck, venvCheck, pathCheck] = await Promise.all([
      checkPip(installInfo.command),
      checkPythonVenv(),
      checkPythonPath(installInfo.command),
    ]);

    // Apply dependency-aware skip resolution
    const checks = applyDependencySkips([
      installInfo.check,
      pipCheck,
      venvCheck,
      pathCheck,
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

  async repair(checkName: string): Promise<RepairResult> {
    return {
      checkName,
      success: false,
      message: `PythonPlugin does not support automated repairs for "${checkName}". Please refer to the suggestion shown in the diagnostic output.`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    return {
      checkName,
      success: false,
      message: `Verification for "${checkName}" is not supported by the Python plugin.`,
    };
  }
}
