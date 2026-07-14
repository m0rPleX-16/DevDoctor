import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

/**
 * Check whether pip (Python package manager) is available.
 * Tries pip3, pip, then falls back to `python -m pip`.
 */
export async function checkPip(pythonCmd: string | null): Promise<DiagnosticCheck> {
  const pipCandidates = ['pip3', 'pip'];

  for (const cmd of pipCandidates) {
    const result = await runCommand(cmd, ['--version']);
    if (result.success) {
      // "pip 23.3.1 from /usr/.../pip (python 3.11)"
      const versionMatch = result.stdout.match(/pip\s+(\S+)/i);
      const version = versionMatch ? versionMatch[1] : result.stdout.trim();
      return {
        name: 'python-pip',
        label: 'pip (Package Manager)',
        status: 'pass',
        message: `pip ${version} is available (${cmd}).`,
        detail:
          `pip v${version} is the standard Python package installer, available as the ` +
          `"${cmd}" command. It downloads and installs packages from PyPI (Python Package Index), ` +
          'the central repository for open-source Python libraries. pip also manages transitive ' +
          'dependencies and records them in requirements.txt or pyproject.toml so your project ' +
          'environment can be reproduced on any machine with `pip install -r requirements.txt`.',
        dependsOn: ['python-installation'],
      };
    }
  }

  // Try python -m pip as a last resort
  if (pythonCmd) {
    const result = await runCommand(pythonCmd, ['-m', 'pip', '--version'], { timeoutMs: 5_000 });
    if (result.success) {
      const versionMatch = result.stdout.match(/pip\s+(\S+)/i);
      const version = versionMatch ? versionMatch[1] : '';
      return {
        name: 'python-pip',
        label: 'pip (Package Manager)',
        status: 'pass',
        message: `pip ${version} is available via ${pythonCmd} -m pip.`,
        detail:
          `pip v${version} is available through the Python module interface (${pythonCmd} -m pip) ` +
          'rather than a standalone command on the PATH. This works correctly but means you need ' +
          'to invoke pip through Python explicitly. Consider installing pip as a standalone command ' +
          'with: python3 -m ensurepip --upgrade',
        dependsOn: ['python-installation'],
      };
    }
  }

  return {
    name: 'python-pip',
    label: 'pip (Package Manager)',
    status: 'fail',
    message: 'pip is not available.',
    detail:
      'pip is the standard package manager for Python. Without it, you cannot install ' +
      'third-party libraries. Modern Python 3 installations include pip by default.',
    suggestion:
      'Ensure pip is installed:\n' +
      '  python3 -m ensurepip --upgrade\n' +
      'Or re-install Python and ensure pip is included in the installation.',
    dependsOn: ['python-installation'],
  };
}
