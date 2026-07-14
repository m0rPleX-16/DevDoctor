import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export async function checkGitIdentity(): Promise<DiagnosticCheck> {
  const nameResult = await runCommand('git', ['config', '--global', 'user.name']);
  const emailResult = await runCommand('git', ['config', '--global', 'user.email']);

  const name = nameResult.success ? nameResult.stdout.trim() : null;
  const email = emailResult.success ? emailResult.stdout.trim() : null;

  if (!name || !email) {
    const missing = [];
    if (!name) missing.push('user.name');
    if (!email) missing.push('user.email');

    return {
      name: 'git-identity',
      label: 'Git Identity Configuration',
      status: 'warn',
      message: `Global Git identity is incomplete (missing ${missing.join(' and ')}).`,
      detail:
        'Git uses your name and email address to author commits. Without these configured globally, ' +
        'you may not be able to commit changes, or your commits may not be attributed correctly on platforms like GitHub.',
      suggestion:
        'Run the following commands to configure your identity:\n' +
        (!name ? 'git config --global user.name "Your Name"\n' : '') +
        (!email ? 'git config --global user.email "your.email@example.com"' : ''),
    };
  }

  return {
    name: 'git-identity',
    label: 'Git Identity',
    status: 'pass',
    message: `Configured as ${name} <${email}>.`,
    detail:
      `Your global Git identity is set to "${name} <${email}>". Git embeds this name ` +
      'and email into every commit you create, making it possible for collaborators and ' +
      'platforms like GitHub to attribute changes to you correctly.',
  };
}
