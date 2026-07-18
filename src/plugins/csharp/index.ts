import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import { runCommand } from '../../infra/os/command-runner.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkCsharpSdk } from './checks/sdk-check.js';
import { checkCsharpTargetFramework } from './checks/target-framework-check.js';
import { checkCsharpNuget } from './checks/nuget-check.js';

export class CsharpPlugin implements Plugin {
  readonly name = 'csharp';
  readonly displayName = 'C#';
  readonly description =
    'Diagnoses .NET SDK configurations, frameworks, and NuGet caches for C# projects.';
  readonly category = 'language';
  readonly projectMarkers = ['*.csproj', '*.fsproj', '*.sln', 'global.json', 'appsettings.json'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'csharp-sdk',
        label: '.NET SDK Installation',
        run: checkCsharpSdk,
      },
      {
        name: 'csharp-target-framework',
        label: '.NET Target Framework',
        dependsOn: ['csharp-sdk'],
        run: checkCsharpTargetFramework,
      },
      {
        name: 'csharp-nuget',
        label: 'NuGet Package Cache',
        dependsOn: ['csharp-sdk'],
        run: checkCsharpNuget,
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
    return checkName === 'csharp-nuget';
  }

  async repair(checkName: string): Promise<RepairResult> {
    if (checkName === 'csharp-nuget') {
      try {
        const result = await runCommand('dotnet', ['restore']);
        if (result.success) {
          return {
            checkName,
            success: true,
            message: 'Ran `dotnet restore` to initialize NuGet caches and restore dependencies.',
            rollbackSupported: false,
          };
        } else {
          return {
            checkName,
            success: false,
            message: 'Failed to run `dotnet restore`.',
            detail: result.stderr,
            rollbackSupported: false,
          };
        }
      } catch (err) {
        return {
          checkName,
          success: false,
          message: `Unexpected error running \`dotnet restore\`: ${err instanceof Error ? err.message : String(err)}`,
          rollbackSupported: false,
        };
      }
    }

    return {
      checkName,
      success: false,
      message: `C# plugin does not support automated repairs for "${checkName}".`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    if (checkName === 'csharp-nuget') {
      const checkResult = await checkCsharpNuget();
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
