import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../infra/os/command-runner.js';
import type { Plugin } from '../../core/types/plugin.js';
import type {
  DiagnosticResult,
  DiagnosticTask,
  DiagnosticCheck,
} from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkFastapiVenv } from './checks/venv-check.js';
import { checkFastapiUvicorn } from './checks/uvicorn-check.js';
import { checkFastapiDotenv } from './checks/dotenv-check.js';

export class FastapiPlugin implements Plugin {
  readonly name = 'fastapi';
  readonly displayName = 'FastAPI';
  readonly description =
    'Diagnoses dependencies, settings, and environments for FastAPI applications.';
  readonly category = 'framework';
  readonly projectMarkers = ['requirements.txt', 'pyproject.toml'];

  private isFastapiProject(): boolean {
    const cwd = process.cwd();
    const reqPath = path.join(cwd, 'requirements.txt');
    const pyprojPath = path.join(cwd, 'pyproject.toml');

    if (fs.existsSync(reqPath)) {
      try {
        const content = fs.readFileSync(reqPath, 'utf-8');
        if (content.toLowerCase().includes('fastapi')) return true;
      } catch {
        // Ignore
      }
    }

    if (fs.existsSync(pyprojPath)) {
      try {
        const content = fs.readFileSync(pyprojPath, 'utf-8');
        if (content.toLowerCase().includes('fastapi')) return true;
      } catch {
        // Ignore
      }
    }

    return false;
  }

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    if (!this.isFastapiProject()) {
      const durationMs = Math.round(performance.now() - startTime);
      const skipCheck: DiagnosticCheck = {
        name: 'fastapi-project',
        label: 'FastAPI Project Detection',
        status: 'skip',
        message: 'No FastAPI dependency found in requirements.txt or pyproject.toml.',
      };
      return {
        pluginName: this.name,
        displayName: this.displayName,
        timestamp: new Date(),
        durationMs,
        checks: [skipCheck],
        overallStatus: 'skip',
      };
    }

    const tasks: DiagnosticTask[] = [
      {
        name: 'fastapi-venv',
        label: 'Virtual Environment Active',
        run: checkFastapiVenv,
      },
      {
        name: 'fastapi-uvicorn',
        label: 'Uvicorn Installation',
        run: checkFastapiUvicorn,
      },
      {
        name: 'fastapi-dotenv',
        label: 'FastAPI Environment Config',
        run: checkFastapiDotenv,
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
    return checkName === 'fastapi-venv';
  }

  async repair(checkName: string): Promise<RepairResult> {
    if (checkName === 'fastapi-venv') {
      try {
        const result = await runCommand('python', ['-m', 'venv', '.venv']);
        if (result.success) {
          // Also try to add .venv to .gitignore
          const cwd = process.cwd();
          const gitignorePath = path.join(cwd, '.gitignore');
          if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
            if (!gitignoreContent.includes('.venv')) {
              fs.appendFileSync(gitignorePath, '\n# Virtual environment\n.venv\n', 'utf-8');
            }
          }

          return {
            checkName,
            success: true,
            message: 'Created a new Python virtual environment in `.venv`.',
            rollbackSupported: false,
          };
        } else {
          return {
            checkName,
            success: false,
            message: 'Failed to create virtual environment.',
            detail: result.stderr,
            rollbackSupported: false,
          };
        }
      } catch (err) {
        return {
          checkName,
          success: false,
          message: `Unexpected error creating virtual environment: ${err instanceof Error ? err.message : String(err)}`,
          rollbackSupported: false,
        };
      }
    }

    return {
      checkName,
      success: false,
      message: `FastAPI plugin does not support automated repairs for "${checkName}".`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    if (checkName === 'fastapi-venv') {
      const checkResult = await checkFastapiVenv();
      return {
        checkName,
        success: checkResult.status === 'pass',
        message: checkResult.message,
      };
    }

    return {
      checkName,
      success: false,
      message: `Verification for "${checkName}" is not supported.`,
    };
  }
}
