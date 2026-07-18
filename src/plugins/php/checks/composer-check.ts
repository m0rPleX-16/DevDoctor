import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export async function checkComposer(): Promise<DiagnosticCheck> {
  try {
    const result = await runCommand('composer', ['--version']);
    if (result.success) {
      const raw = result.stdout.trim();
      // Composer version 2.7.2 2024-03-11 17:12:18
      const versionMatch = raw.match(/Composer version\s+(\d+(?:\.\d+)*)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        name: 'composer-version',
        label: 'Composer Installation',
        status: 'pass',
        message: `Composer ${version} is installed.`,
        detail:
          'Composer is the standard dependency manager for PHP, used to manage project packages.',
      };
    }
  } catch {
    // fall through
  }

  return {
    name: 'composer-version',
    label: 'Composer Installation',
    status: 'warn',
    message: 'Composer was not found on the system PATH.',
    detail:
      'Composer is required to install dependencies for PHP frameworks like Laravel and Symfony.',
    suggestion: 'Install Composer from https://getcomposer.org/ and add it to your PATH.',
  };
}
