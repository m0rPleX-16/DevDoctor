import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export async function checkDefaultBranch(): Promise<DiagnosticCheck> {
  const result = await runCommand('git', ['config', '--global', 'init.defaultBranch']);

  if (!result.success || !result.stdout.trim()) {
    return {
      name: 'git-default-branch',
      label: 'Default Branch Name',
      status: 'warn',
      message: 'No global default branch name is configured.',
      detail:
        'When you run `git init` in a new repository, Git uses a default branch name. Historically, ' +
        'this was "master", but the industry standard has moved to "main". Configuring this globally ' +
        'ensures all your new repositories use a consistent, modern branch name.',
      suggestion: 'Run: git config --global init.defaultBranch main',
    };
  }

  const branchName = result.stdout.trim();

  if (branchName !== 'main') {
    return {
      name: 'git-default-branch',
      label: 'Default Branch Name',
      status: 'pass', // Not a failure, just an observation
      message: `Configured as "${branchName}".`,
      detail:
        `Your default branch is set to "${branchName}". While "main" is the current industry standard, ` +
        'any valid branch name is perfectly fine as long as your team is aligned.',
    };
  }

  return {
    name: 'git-default-branch',
    label: 'Default Branch Name',
    status: 'pass',
    message: 'Configured as "main".',
    detail: 'Your global default branch is configured to the modern standard ("main").',
  };
}
