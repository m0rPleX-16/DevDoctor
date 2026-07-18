import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

function findCsharpProjectFiles(dir: string, maxDepth = 2, currentDepth = 0): string[] {
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return [];

  const results: string[] = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.venv', 'venv', '.git', 'bin', 'obj'].includes(entry.name)) {
          continue;
        }
        results.push(...findCsharpProjectFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.csproj') || entry.name === 'global.json')
      ) {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }
  return results;
}

export async function checkCsharpTargetFramework(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const files = findCsharpProjectFiles(cwd);

  if (files.length === 0) {
    return {
      name: 'csharp-target-framework',
      label: '.NET Target Framework',
      status: 'pass',
      message: 'No .csproj or global.json files found to check target frameworks.',
      dependsOn: ['csharp-sdk'],
    };
  }

  const warnings: string[] = [];

  for (const file of files) {
    const relativeName = path.relative(cwd, file);
    try {
      const content = fs.readFileSync(file, 'utf-8');

      if (file.endsWith('.csproj')) {
        // Match <TargetFramework> or <TargetFrameworks>
        const singleMatch = content.match(/<TargetFramework>(.*?)<\/TargetFramework>/);
        const multiMatch = content.match(/<TargetFrameworks>(.*?)<\/TargetFrameworks>/);

        const frameworks = singleMatch
          ? [singleMatch[1]]
          : multiMatch
            ? multiMatch[1].split(';')
            : [];

        for (const tfm of frameworks) {
          const trimmed = tfm.trim();
          if (!trimmed) continue;

          // Match netX.Y format
          const match = trimmed.match(/^net(\d+)\.(\d+)/);
          if (match) {
            const major = parseInt(match[1], 10);
            if (major < 6) {
              warnings.push(
                `${relativeName} targets "${trimmed}", which is out of support. Recommended versions are .NET 6.0, 8.0, or newer.`,
              );
            }
          } else if (
            trimmed.startsWith('netcoreapp') ||
            trimmed.startsWith('netstandard') ||
            trimmed.startsWith('net4')
          ) {
            warnings.push(`${relativeName} targets legacy framework "${trimmed}".`);
          }
        }
      } else if (path.basename(file) === 'global.json') {
        const json = JSON.parse(content);
        const sdkVersion = json?.sdk?.version;
        if (sdkVersion) {
          const match = sdkVersion.match(/^(\d+)/);
          if (match) {
            const major = parseInt(match[1], 10);
            if (major < 6) {
              warnings.push(`global.json specifies legacy SDK version "${sdkVersion}".`);
            }
          }
        }
      }
    } catch {
      // Ignore parse/read errors
    }
  }

  if (warnings.length > 0) {
    return {
      name: 'csharp-target-framework',
      label: '.NET Target Framework',
      status: 'warn',
      message: 'Legacy or unsupported .NET target frameworks detected.',
      detail: warnings.join('\n'),
      suggestion:
        'Upgrade your target framework version in the .csproj file or global.json to .NET 8.0 (LTS) or newer.',
      dependsOn: ['csharp-sdk'],
    };
  }

  return {
    name: 'csharp-target-framework',
    label: '.NET Target Framework',
    status: 'pass',
    message: '.NET target framework versions are supported.',
    detail: 'All verified project files target .NET 6.0 or newer.',
    dependsOn: ['csharp-sdk'],
  };
}
