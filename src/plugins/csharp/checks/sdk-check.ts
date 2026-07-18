import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkCsharpSdk(): Promise<DiagnosticCheck> {
  const result = await runCommand('dotnet', ['--version']);

  if (!result.success) {
    return {
      name: 'csharp-sdk',
      label: '.NET SDK Installation',
      status: 'fail',
      message: '.NET SDK is not installed or not found on the system PATH.',
      detail:
        'The .NET SDK is required to build, run, and publish C# projects and libraries using the dotnet CLI compiler.',
      suggestion:
        'Download and install the .NET SDK from the official Microsoft site: https://dotnet.microsoft.com/download.',
    };
  }

  const version = result.stdout.trim();
  return {
    name: 'csharp-sdk',
    label: '.NET SDK Installation',
    status: 'pass',
    message: `.NET SDK is installed (version ${version}).`,
    detail: `Successfully executed: dotnet --version`,
  };
}
