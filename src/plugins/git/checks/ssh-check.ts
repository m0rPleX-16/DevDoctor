import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkSshKeys(): Promise<DiagnosticCheck> {
  const sshDir = path.join(os.homedir(), '.ssh');
  const keyTypes = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
  const foundKeys: string[] = [];

  try {
    const files = await fs.readdir(sshDir);
    for (const file of files) {
      if (keyTypes.includes(file)) {
        foundKeys.push(file);
      }
    }
  } catch {
    // .ssh directory does not exist or is unreadable — treat as no keys found
  }

  if (foundKeys.length === 0) {
    return {
      name: 'git-ssh',
      label: 'SSH Keys',
      status: 'warn',
      message: 'No standard SSH keys found in ~/.ssh.',
      detail:
        'SSH keys allow you to authenticate with remote Git repositories (like GitHub, GitLab, ' +
        'or Bitbucket) without typing your password every time. While HTTPS with a Personal ' +
        'Access Token is a valid alternative, SSH is widely considered the most robust ' +
        'authentication method for Git. Note that finding a key file does not guarantee it is ' +
        'functional — the private key must have restrictive permissions (600 on Unix) and may ' +
        'need to be added to ssh-agent to work correctly.',
      suggestion:
        'If you use SSH for Git, generate a new key by running:\n' +
        '  ssh-keygen -t ed25519 -C "your_email@example.com"\n' +
        'Then add it to your SSH agent:\n' +
        '  ssh-add ~/.ssh/id_ed25519\n' +
        'And add the public key (~/.ssh/id_ed25519.pub) to your Git hosting account.',
    };
  }

  return {
    name: 'git-ssh',
    label: 'SSH Keys',
    status: 'pass',
    message: `Found SSH key file(s): ${foundKeys.join(', ')}.`,
    detail:
      'You have SSH key files in ~/.ssh that can be used for authentication with remote ' +
      'repositories. Ensure the private key has restrictive permissions (600 on Unix) and ' +
      'is loaded in your SSH agent (`ssh-add`) for seamless use.',
  };
}
