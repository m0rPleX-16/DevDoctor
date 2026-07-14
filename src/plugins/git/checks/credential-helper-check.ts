/**
 * Credential Helper Check
 *
 * What this teaches:
 * - Why Git needs to store credentials at all (HTTPS vs SSH)
 * - What a credential helper does and why it's better than re-typing passwords
 * - The most common helpers per platform (GCM, osxkeychain, libsecret)
 */

import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

const CREDENTIAL_DETAIL =
  'When you push or pull from a remote repository over HTTPS, Git needs to authenticate you. ' +
  'Without a credential helper, Git prompts for your username and password (or personal access token) ' +
  'on every operation. A credential helper stores your credentials securely in the OS keychain ' +
  '(Windows Credential Manager, macOS Keychain, or libsecret on Linux) so you only authenticate once.';

export async function checkCredentialHelper(): Promise<DiagnosticCheck> {
  const result = await runCommand('git', ['config', '--global', 'credential.helper']);
  const helper = result.stdout.trim();

  if (!result.success || !helper) {
    return {
      name: 'git-credential-helper',
      label: 'Credential Helper',
      status: 'warn',
      message: 'No global Git credential helper is configured.',
      detail: CREDENTIAL_DETAIL,
      suggestion:
        'Install and configure Git Credential Manager (recommended, works on all platforms):\n' +
        '  https://github.com/git-ecosystem/git-credential-manager\n\n' +
        'Platform-specific alternatives:\n' +
        '  Windows:  git config --global credential.helper manager\n' +
        '  macOS:    git config --global credential.helper osxkeychain\n' +
        '  Linux:    git config --global credential.helper libsecret\n\n' +
        'Note: if you use SSH keys for all remotes, this warning does not apply to you.',
    };
  }

  // Recognise well-known helpers and give a friendlier description
  const helperDescriptions: Record<string, string> = {
    manager: 'Git Credential Manager',
    'manager-core': 'Git Credential Manager Core',
    osxkeychain: 'macOS Keychain',
    libsecret: 'GNOME libsecret',
    wincred: 'Windows Credential Store',
    store: 'plaintext file store (~/.git-credentials)',
    cache: 'in-memory cache',
  };

  // Match against the beginning of the helper value (it may include a path)
  const knownKey = Object.keys(helperDescriptions).find((k) => helper.startsWith(k));
  const helperLabel = knownKey ? `${helperDescriptions[knownKey]} (${helper})` : helper;

  const isPlaintext = helper === 'store';

  return {
    name: 'git-credential-helper',
    label: 'Credential Helper',
    status: isPlaintext ? 'warn' : 'pass',
    message: isPlaintext
      ? `Credential helper is set to 'store' (plaintext). Consider a secure alternative.`
      : `Configured: ${helperLabel}.`,
    detail:
      CREDENTIAL_DETAIL + '\n\n' +
      (isPlaintext
        ? 'The "store" helper saves credentials in a plaintext file (~/.git-credentials). ' +
          'This is convenient but insecure — anyone with access to your home directory can read your tokens.'
        : `Your credential helper (${helperLabel}) stores credentials securely. ` +
          'You will only be prompted to authenticate once per remote.'),
    suggestion: isPlaintext
      ? 'Replace the plaintext store with a secure keychain-backed helper:\n' +
        '  Windows:  git config --global credential.helper manager\n' +
        '  macOS:    git config --global credential.helper osxkeychain\n' +
        '  Linux:    git config --global credential.helper libsecret'
      : undefined,
  };
}
