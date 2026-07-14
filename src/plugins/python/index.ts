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

import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import type { DiagnosticTask } from '../../core/types/diagnostic.js';
import { checkPythonInstallation } from './checks/installation-check.js';
import { checkPip } from './checks/pip-check.js';
import { checkPythonVenv } from './checks/venv-check.js';
import { checkPythonPath } from './checks/path-check.js';
import { runCommand } from '../../infra/os/command-runner.js';

export class PythonPlugin implements Plugin {
  readonly name = 'python';
  readonly displayName = 'Python';
  readonly description = 'Diagnoses your Python development environment.';
  readonly projectMarkers = [
    'requirements.txt', 'pyproject.toml', 'setup.py', 'setup.cfg',
    'Pipfile', '.python-version', '.venv', 'venv', 'conda.yaml', 'environment.yml',
  ];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    // Step 1: resolve the Python executable first — downstream checks need the command name.
    // We run this eagerly outside the task runner so the resolved command is available
    // as a closure variable for dependent tasks.
    const installInfo = await checkPythonInstallation();

    const tasks: DiagnosticTask[] = [
      {
        name: 'python-installation',
        label: 'Python Installation',
        run: async () => installInfo.check,
      },
      {
        name: 'python-pip',
        label: 'pip',
        dependsOn: ['python-installation'],
        run: () => checkPip(installInfo.command),
      },
      {
        name: 'python-venv',
        label: 'Virtual Environment',
        dependsOn: ['python-installation'],
        run: checkPythonVenv,
      },
      {
        name: 'python-path',
        label: 'Python PATH',
        dependsOn: ['python-installation'],
        run: () => checkPythonPath(installInfo.command),
      },
    ];

    const checks = await runDiagnosticTasks(tasks);
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

  canRepair(checkName: string): boolean {
    return checkName === 'python-venv';
  }

  async repair(checkName: string): Promise<RepairResult> {
    if (checkName === 'python-venv') {
      try {
        const installInfo = await checkPythonInstallation();
        const pythonCmd = installInfo.command;

        if (!pythonCmd) {
          return {
            checkName,
            success: false,
            message: 'Cannot create virtual environment: Python is not installed or not found on the system PATH.',
            rollbackSupported: false,
          };
        }

        const venvDir = path.join(process.cwd(), '.venv');
        if (fs.existsSync(venvDir)) {
          return {
            checkName,
            success: true,
            message: 'A virtual environment directory (.venv) already exists in the current directory.',
            detail: `Tip: To activate it in your current terminal, run:\n` +
              `  .venv\\Scripts\\activate        (Windows PowerShell)\n` +
              `  source .venv/bin/activate     (macOS/Linux)`,
            rollbackSupported: false,
          };
        }

        const result = await runCommand(pythonCmd, ['-m', 'venv', '.venv'], { timeoutMs: 60_000 });
        if (!result.success) {
          return {
            checkName,
            success: false,
            message: `Failed to create virtual environment using ${pythonCmd}.`,
            detail: result.stderr,
            rollbackSupported: false,
          };
        }

        return {
          checkName,
          success: true,
          message: `Successfully created Python virtual environment inside ".venv" using ${pythonCmd}.`,
          detail: `Created virtualenv at: ${venvDir}\n` +
            `›  Tip: You still need to activate it in your terminal by running:\n` +
            `   - Windows: .venv\\Scripts\\activate\n` +
            `   - macOS/Linux: source .venv/bin/activate`,
          rollbackSupported: true,
        };
      } catch (err) {
        return {
          checkName,
          success: false,
          message: `Unexpected error during repair: ${err instanceof Error ? err.message : String(err)}`,
          rollbackSupported: false,
        };
      }
    }

    return {
      checkName,
      success: false,
      message: `PythonPlugin does not support automated repairs for "${checkName}". Please refer to the suggestion shown in the diagnostic output.`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    if (checkName === 'python-venv') {
      const venvDir = path.join(process.cwd(), '.venv');
      const isWindows = process.platform === 'win32';
      const activatePath = isWindows
        ? path.join(venvDir, 'Scripts', 'activate.bat')
        : path.join(venvDir, 'bin', 'activate');

      const success = fs.existsSync(activatePath);
      return {
        checkName,
        success,
        message: success
          ? 'Virtual environment directory (.venv) exists with activation scripts.'
          : 'Virtual environment activation script not found inside .venv.',
      };
    }

    return {
      checkName,
      success: false,
      message: `Verification for "${checkName}" is not supported by the Python plugin.`,
    };
  }

  async rollback(checkName: string): Promise<RepairResult> {
    if (checkName === 'python-venv') {
      try {
        const venvDir = path.join(process.cwd(), '.venv');
        if (fs.existsSync(venvDir)) {
          fs.rmSync(venvDir, { recursive: true, force: true });
          return {
            checkName,
            success: true,
            message: 'Successfully rolled back: deleted the ".venv" directory.',
            rollbackSupported: false,
          };
        }
        return {
          checkName,
          success: true,
          message: 'No ".venv" directory found to roll back.',
          rollbackSupported: false,
        };
      } catch (err) {
        return {
          checkName,
          success: false,
          message: `Unexpected error during rollback: ${err instanceof Error ? err.message : String(err)}`,
          rollbackSupported: false,
        };
      }
    }

    return {
      checkName,
      success: false,
      message: `Rollback is not supported for "${checkName}".`,
      rollbackSupported: false,
    };
  }
}
