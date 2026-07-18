import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export interface PhpInstallInfo {
  check: DiagnosticCheck;
  version: string | null;
}

export async function checkPhpInstallation(): Promise<PhpInstallInfo> {
  try {
    const result = await runCommand('php', ['-v']);
    if (result.success) {
      const raw = result.stdout.trim();
      // Raw example: "PHP 8.2.12 (cli) (built: Oct 24 2023 21:15:15) (NTS)"
      const versionMatch = raw.match(/PHP\s+(\d+(?:\.\d+)*)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      const majorMatch = version.match(/^(\d+)\.(\d+)/);
      const major = majorMatch ? parseInt(majorMatch[1], 10) : 0;
      const minor = majorMatch ? parseInt(majorMatch[2], 10) : 0;

      if (major < 8 || (major === 8 && minor < 1)) {
        return {
          version,
          check: {
            name: 'php-installation',
            label: 'PHP Installation',
            status: 'warn',
            message: `PHP ${version} is installed, but version 8.1+ is highly recommended.`,
            detail:
              'Older versions of PHP are end-of-life and do not receive security updates or support modern features.',
            suggestion:
              'Upgrade PHP to 8.1 or higher (PHP 8.2/8.3 recommended) via Homebrew (macOS), your system package manager (Linux), or PHP for Windows.',
          },
        };
      }

      return {
        version,
        check: {
          name: 'php-installation',
          label: 'PHP Installation',
          status: 'pass',
          message: `PHP ${version} is installed.`,
          detail: `PHP was successfully found on your PATH.`,
        },
      };
    }
  } catch {
    // fall through
  }

  return {
    version: null,
    check: {
      name: 'php-installation',
      label: 'PHP Installation',
      status: 'fail',
      message: 'PHP is not installed or not found on the system PATH.',
      detail:
        'PHP is a popular general-purpose scripting language that is especially suited to web development.',
      suggestion: 'Install PHP 8.1+ and ensure it is added to your environment PATH variables.',
    },
  };
}
