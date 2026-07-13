import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export interface PythonInstallInfo {
  check: DiagnosticCheck;
  /** Resolved command to invoke Python (e.g. 'python3' or 'python') */
  command: string | null;
  /** Detected version string (e.g. '3.11.4') */
  version: string | null;
}

/**
 * Detect the Python executable and version.
 * Tries 'python3' first (preferred on modern Unix), then 'python' (Windows / legacy).
 */
export async function checkPythonInstallation(): Promise<PythonInstallInfo> {
  const candidates = ['python3', 'python'];

  for (const cmd of candidates) {
    const result = await runCommand(cmd, ['--version']);
    if (result.success) {
      // Python 3 prints to stdout; Python 2 prints to stderr
      const raw = (result.stdout || result.stderr).trim();
      // "Python 3.11.4"
      const versionMatch = raw.match(/Python\s+(\d+\.\d+\.\d+)/i);
      const version = versionMatch ? versionMatch[1] : raw;
      const major = versionMatch ? parseInt(versionMatch[1].split('.')[0], 10) : 0;

      if (major < 3) {
        return {
          command: cmd,
          version,
          check: {
            name: 'python-installation',
            label: 'Python Installation',
            status: 'warn',
            message: `Python ${version} is installed, but Python 2 is end-of-life.`,
            detail:
              'Python 2 reached end-of-life on January 1, 2020, and no longer receives ' +
              'security updates. Most modern libraries and tools require Python 3.',
            suggestion:
              'Install Python 3 from https://www.python.org/downloads/\n' +
              'macOS/Linux: brew install python3 or use your system package manager.\n' +
              'Consider using pyenv to manage multiple Python versions.',
          },
        };
      }

      return {
        command: cmd,
        version,
        check: {
          name: 'python-installation',
          label: 'Python Installation',
          status: 'pass',
          message: `Python ${version} is installed (${cmd}).`,
          detail: `Python ${version} was found at the command "${cmd}". Python 3.8+ is recommended for most modern projects.`,
        },
      };
    }
  }

  return {
    command: null,
    version: null,
    check: {
      name: 'python-installation',
      label: 'Python Installation',
      status: 'fail',
      message: 'Python is not installed or not found on the system PATH.',
      detail:
        'Python is a high-level general-purpose programming language widely used in web ' +
        'development, data science, automation, and machine learning. It must be on the ' +
        'PATH for tools like pip, Django, Flask, and pytest to work.',
      suggestion:
        'Install Python 3 from https://www.python.org/downloads/\n' +
        'macOS:  brew install python3\n' +
        'Linux:  sudo apt install python3  (Debian/Ubuntu)\n' +
        '        sudo dnf install python3  (Fedora/RHEL)\n' +
        'Windows: Download the installer from python.org and check "Add Python to PATH".',
    },
  };
}
