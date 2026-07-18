import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkJavaInstallation } from './checks/installation-check.js';
import { checkJavaHome } from './checks/home-check.js';
import { checkJavaBuildTools } from './checks/build-tools-check.js';

export class JavaPlugin implements Plugin {
  readonly name = 'java';
  readonly displayName = 'Java';
  readonly description =
    'Diagnoses JDK installations, environment variables, and build tools for Java projects.';
  readonly category = 'language';
  readonly projectMarkers = ['pom.xml', 'build.gradle', 'build.gradle.kts', '*.java'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'java-installation',
        label: 'Java Runtime Installation',
        run: checkJavaInstallation,
      },
      {
        name: 'java-home',
        label: 'JAVA_HOME Environment Variable',
        dependsOn: ['java-installation'],
        run: checkJavaHome,
      },
      {
        name: 'java-build-tools',
        label: 'Java Build Tools',
        dependsOn: ['java-installation'],
        run: checkJavaBuildTools,
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
      message: 'Java plugin does not support automated repairs.',
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
