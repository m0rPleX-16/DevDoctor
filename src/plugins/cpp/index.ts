import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkCppCompiler } from './checks/compiler-check.js';
import { checkCppBuildGenerator } from './checks/build-generator-check.js';

export class CppPlugin implements Plugin {
  readonly name = 'cpp';
  readonly displayName = 'C++';
  readonly description =
    'Diagnoses compiler availability and build configurations for C++ projects.';
  readonly category = 'language';
  readonly projectMarkers = [
    '*.cpp',
    '*.hpp',
    '*.cxx',
    '*.hxx',
    '*.cc',
    '*.h',
    'CMakeLists.txt',
    'Makefile',
    '*.vcxproj',
    '*.pro',
  ];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'cpp-compiler',
        label: 'C++ Compiler Detection',
        run: checkCppCompiler,
      },
      {
        name: 'cpp-build-generator',
        label: 'C++ Build Generators',
        dependsOn: ['cpp-compiler'],
        run: checkCppBuildGenerator,
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
      message: 'C++ plugin does not support automated repairs.',
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
