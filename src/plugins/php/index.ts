import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkPhpInstallation } from './checks/installation-check.js';
import { checkComposer } from './checks/composer-check.js';
import { checkPhpIni } from './checks/ini-check.js';

export class PhpPlugin implements Plugin {
  readonly name = 'php';
  readonly displayName = 'PHP';
  readonly description = 'Diagnoses PHP runtime environment, configuration, and composer manager.';
  readonly category = 'language';
  readonly projectMarkers = ['composer.json', 'composer.lock', 'php.ini', '*.php'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'php-installation',
        label: 'PHP Installation',
        run: async () => {
          const info = await checkPhpInstallation();
          return info.check;
        },
      },
      {
        name: 'composer-version',
        label: 'Composer Installation',
        dependsOn: ['php-installation'],
        run: checkComposer,
      },
      {
        name: 'php-ini',
        label: 'php.ini Configuration File',
        dependsOn: ['php-installation'],
        run: checkPhpIni,
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
      message: 'PHP plugin does not support automated repairs.',
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
