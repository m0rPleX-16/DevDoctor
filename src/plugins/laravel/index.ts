import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkLaravelAppKey } from './checks/app-key-check.js';
import { checkLaravelEnv } from './checks/env-check.js';
import { checkLaravelStorageWritable } from './checks/storage-writable-check.js';
import { checkLaravelVendor } from './checks/vendor-check.js';

export class LaravelPlugin implements Plugin {
  readonly name = 'laravel';
  readonly displayName = 'Laravel';
  readonly description = 'Diagnoses files, permissions, and settings for Laravel projects.';
  readonly category = 'framework';
  readonly projectMarkers = ['artisan', 'composer.json'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'laravel-env',
        label: 'Laravel .env Presence',
        run: checkLaravelEnv,
      },
      {
        name: 'laravel-app-key',
        label: 'Laravel APP_KEY Configuration',
        dependsOn: ['laravel-env'],
        run: checkLaravelAppKey,
      },
      {
        name: 'laravel-storage-writable',
        label: 'Laravel Storage & Cache Writability',
        run: checkLaravelStorageWritable,
      },
      {
        name: 'laravel-vendor',
        label: 'Laravel Dependencies',
        run: checkLaravelVendor,
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

  canRepair(): boolean {
    return false;
  }

  async repair(checkName: string): Promise<RepairResult> {
    return {
      checkName,
      success: false,
      message: 'Laravel plugin does not support automated repairs.',
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    return {
      checkName,
      success: false,
      message: `Verification for "${checkName}" is not supported.`,
    };
  }
}
