import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkNextjsVersion } from './checks/version-check.js';
import { checkNextjsEnvLocal } from './checks/env-local-check.js';
import { checkNextjsEnvHygiene } from './checks/env-hygiene-check.js';
import { checkNextjsCacheStaleness } from './checks/cache-staleness-check.js';

export class NextjsPlugin implements Plugin {
  readonly name = 'nextjs';
  readonly displayName = 'Next.js';
  readonly description = 'Diagnoses environment and cache configurations for Next.js projects.';
  readonly category = 'framework';
  readonly projectMarkers = ['next.config.js', 'next.config.ts', 'next.config.mjs'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'nextjs-version',
        label: 'Next.js Version',
        run: checkNextjsVersion,
      },
      {
        name: 'nextjs-env-local',
        label: '.env.local Presence',
        dependsOn: ['nextjs-version'],
        run: checkNextjsEnvLocal,
      },
      {
        name: 'nextjs-env-hygiene',
        label: 'Next.js Environment Hygiene',
        dependsOn: ['nextjs-version'],
        run: checkNextjsEnvHygiene,
      },
      {
        name: 'nextjs-cache-staleness',
        label: 'Next.js Cache Staleness',
        dependsOn: ['nextjs-version'],
        run: checkNextjsCacheStaleness,
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
    return checkName === 'nextjs-env-local' || checkName === 'nextjs-cache-staleness';
  }

  async repair(checkName: string): Promise<RepairResult> {
    const cwd = process.cwd();

    if (checkName === 'nextjs-env-local') {
      try {
        const envLocalPath = path.join(cwd, '.env.local');
        fs.writeFileSync(envLocalPath, '# Local development environment variables\n', 'utf-8');

        // Try to add to .gitignore if it exists
        const gitignorePath = path.join(cwd, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
          if (
            !gitignoreContent.includes('.env*.local') &&
            !gitignoreContent.includes('.env.local')
          ) {
            fs.appendFileSync(gitignorePath, '\n# local env files\n.env*.local\n', 'utf-8');
          }
        }

        return {
          checkName,
          success: true,
          message: 'Created .env.local file.',
          rollbackSupported: false,
        };
      } catch (err) {
        return {
          checkName,
          success: false,
          message: `Failed to create .env.local: ${err instanceof Error ? err.message : String(err)}`,
          rollbackSupported: false,
        };
      }
    }

    if (checkName === 'nextjs-cache-staleness') {
      try {
        const cachePath = path.join(cwd, '.next', 'cache');
        if (fs.existsSync(cachePath)) {
          fs.rmSync(cachePath, { recursive: true, force: true });
        }
        return {
          checkName,
          success: true,
          message: 'Cleared .next/cache directory.',
          rollbackSupported: false,
        };
      } catch (err) {
        return {
          checkName,
          success: false,
          message: `Failed to clear .next/cache: ${err instanceof Error ? err.message : String(err)}`,
          rollbackSupported: false,
        };
      }
    }

    return {
      checkName,
      success: false,
      message: `Next.js plugin does not support automated repairs for "${checkName}".`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    if (checkName === 'nextjs-env-local') {
      const checkResult = await checkNextjsEnvLocal();
      return {
        checkName,
        success: checkResult.status === 'pass',
        message: checkResult.message,
      };
    }

    if (checkName === 'nextjs-cache-staleness') {
      const checkResult = await checkNextjsCacheStaleness();
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
