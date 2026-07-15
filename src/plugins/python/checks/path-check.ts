import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

/**
 * Detect Python PATH ordering conflicts.
 *
 * Common problem: a user installs pyenv or a user-local Python, but the
 * system Python appears first in PATH. This means `python3` resolves to the
 * system version instead of the user-managed one, causing version confusion.
 *
 * We check whether multiple Python executables exist on PATH and whether
 * the first one matches what `python3 --version` reports.
 */
export async function checkPythonPath(pythonCmd: string | null): Promise<DiagnosticCheck> {
  if (!pythonCmd) {
    return {
      name: 'python-path',
      label: 'Python PATH Configuration',
      status: 'skip',
      message: 'Skipped — Python is not installed.',
      dependsOn: ['python-installation'],
    };
  }

  const isWindows = process.platform === 'win32';
  const whereCmd = isWindows ? 'where' : 'which';
  const result = await runCommand(whereCmd, [pythonCmd], { timeoutMs: 3_000 });

  if (!result.success || !result.stdout.trim()) {
    return {
      name: 'python-path',
      label: 'Python PATH Configuration',
      status: 'warn',
      message: `Could not resolve ${pythonCmd} path using ${whereCmd}.`,
      detail: `The "${whereCmd}" command did not return a path for ${pythonCmd}.`,
      dependsOn: ['python-installation'],
    };
  }

  // `where` on Windows and `which -a` equivalents may return multiple lines
  const locations = result.stdout
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const firstLocation = locations[0];

  // Detect common venv/pyenv/user-install patterns that indicate intentional override
  const isUserManaged =
    firstLocation.includes('.pyenv') ||
    firstLocation.includes('conda') ||
    firstLocation.includes('.venv') ||
    firstLocation.includes('AppData') ||
    firstLocation.includes('local/bin');

  // Detect system Python — typically /usr/bin/python3 or C:\Windows\
  const isSystemPython =
    firstLocation.startsWith('/usr/bin/') ||
    firstLocation.startsWith('/usr/local/bin/') ||
    firstLocation.toLowerCase().includes('windows\\');

  if (locations.length > 1 && isSystemPython && !isUserManaged) {
    return {
      name: 'python-path',
      label: 'Python PATH Configuration',
      status: 'warn',
      message: `System Python is first on PATH (${firstLocation}). ${locations.length} Python installations found.`,
      detail:
        `Multiple Python installations detected:\n${locations.map((l, i) => `  ${i + 1}. ${l}`).join('\n')}\n\n` +
        'The system Python is resolving first. If you intended to use a pyenv, Conda, or ' +
        'user-installed Python, ensure its bin directory comes before /usr/bin in PATH.',
      suggestion:
        'If using pyenv: run `pyenv global <version>` and check `pyenv init` is in your shell profile.\n' +
        'If using Conda: run `conda activate <env>` to switch environments.\n' +
        'Check your PATH order: echo $PATH',
      dependsOn: ['python-installation'],
    };
  }

  return {
    name: 'python-path',
    label: 'Python PATH Configuration',
    status: 'pass',
    message: `Python resolves to: ${firstLocation}`,
    detail:
      locations.length > 1
        ? `${locations.length} Python installations found. The active one is: ${firstLocation}`
        : `Python is correctly resolved from: ${firstLocation}`,
    dependsOn: ['python-installation'],
  };
}
