import fs from 'node:fs';
import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkCsharpNuget(): Promise<DiagnosticCheck> {
  const result = await runCommand('dotnet', ['nuget', 'locals', 'global-packages', '--list']);

  if (!result.success) {
    return {
      name: 'csharp-nuget',
      label: 'NuGet Package Cache',
      status: 'warn',
      message: 'Failed to retrieve NuGet global packages cache location.',
      detail: result.stderr || 'Command failed with non-zero exit code.',
      suggestion:
        'Ensure the dotnet SDK is properly installed and you have sufficient permissions to run dotnet CLI tools.',
      dependsOn: ['csharp-sdk'],
    };
  }

  // Parse path from: "info : global-packages: C:\Users\name\.nuget\packages\" or similar
  const output = result.stdout.trim();
  const match = output.match(/global-packages:\s*(.+)$/m);
  const cachePath = match ? match[1].trim() : null;

  if (!cachePath) {
    return {
      name: 'csharp-nuget',
      label: 'NuGet Package Cache',
      status: 'warn',
      message: 'Could not parse NuGet package cache location from dotnet output.',
      detail: `Output was: ${output}`,
      dependsOn: ['csharp-sdk'],
    };
  }

  if (!fs.existsSync(cachePath)) {
    return {
      name: 'csharp-nuget',
      label: 'NuGet Package Cache',
      status: 'warn',
      message: `NuGet packages cache directory does not exist: "${cachePath}".`,
      detail:
        'This folder stores package files restored by dotnet restore. Usually it is created automatically, but missing directory can indicate restore issues.',
      suggestion:
        'Run `dotnet restore` in your C# project to restore packages and initialize the cache folder.',
      dependsOn: ['csharp-sdk'],
    };
  }

  try {
    fs.accessSync(cachePath, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    return {
      name: 'csharp-nuget',
      label: 'NuGet Package Cache',
      status: 'fail',
      message: `NuGet packages cache directory is not readable/writable: "${cachePath}".`,
      detail:
        'Dotnet compile and package restore commands will fail if they cannot write to the global packages cache folder.',
      suggestion: `Fix permissions on "${cachePath}" to allow read/write access for the current user.`,
      dependsOn: ['csharp-sdk'],
    };
  }

  return {
    name: 'csharp-nuget',
    label: 'NuGet Package Cache',
    status: 'pass',
    message: 'NuGet packages cache directory is accessible.',
    detail: `Verified read/write access to NuGet folder: ${cachePath}`,
    dependsOn: ['csharp-sdk'],
  };
}
