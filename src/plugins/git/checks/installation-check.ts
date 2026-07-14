import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export async function checkGitInstallation(): Promise<DiagnosticCheck> {
  const result = await runCommand('git', ['--version']);

  if (!result.success) {
    return {
      name: 'git-installation',
      label: 'Git Installation',
      status: 'fail',
      message: 'Git is not installed or not found on the system PATH.',
      detail:
        'Git is a distributed version control system that tracks changes in any set of computer files, ' +
        'usually used for coordinating work among programmers collaboratively developing source code during software development.',
      suggestion:
        'Install Git from https://git-scm.com/downloads and ensure it is added to your system PATH.',
    };
  }

  const version = result.stdout.trim().replace(/^git version\s+/, '');

  return {
    name: 'git-installation',
    label: 'Git Installation',
    status: 'pass',
    message: `Git is installed (v${version}).`,
    detail:
      `Git v${version} is available on your system. Git is a distributed version control ` +
      'system that tracks changes to files over time, enabling collaboration, code history, ' +
      'and branching workflows. It is a prerequisite for all other Git checks.',
  };
}
