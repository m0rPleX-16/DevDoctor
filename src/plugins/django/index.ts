import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkDjangoSettingsModule } from './checks/settings-module-check.js';
import { checkDjangoSecretKey } from './checks/secret-key-check.js';
import { checkDjangoDebug } from './checks/debug-check.js';
import { checkDjangoAllowedHosts } from './checks/allowed-hosts-check.js';

export class DjangoPlugin implements Plugin {
  readonly name = 'django';
  readonly displayName = 'Django';
  readonly description = 'Diagnoses settings and configurations for Django projects.';
  readonly category = 'framework';
  readonly projectMarkers = ['manage.py'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'django-settings-module',
        label: 'DJANGO_SETTINGS_MODULE Set',
        run: checkDjangoSettingsModule,
      },
      {
        name: 'django-secret-key',
        label: 'Django SECRET_KEY Hygiene',
        run: checkDjangoSecretKey,
      },
      {
        name: 'django-debug',
        label: 'Django DEBUG Status',
        run: checkDjangoDebug,
      },
      {
        name: 'django-allowed-hosts',
        label: 'Django ALLOWED_HOSTS Configuration',
        run: checkDjangoAllowedHosts,
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
      message: 'Django plugin does not support automated repairs.',
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
