/**
 * PATH Check
 *
 * Checks whether Node.js is properly configured on the system PATH.
 *
 * What this teaches:
 * - What the PATH environment variable is and why it matters
 * - How the operating system finds executables
 * - Common PATH-related issues developers encounter
 */

import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

/**
 * Check if Node.js is accessible via the system PATH.
 *
 * This is subtly different from the version check — a version check
 * tells us IF Node.js is installed, but the PATH check tells us
 * HOW the OS finds it, which is important for understanding
 * environment configuration.
 */
export async function checkNodePath(): Promise<DiagnosticCheck> {
  const isWindows = process.platform === 'win32';

  // Use platform-specific command to find the executable location
  const locateCommand = isWindows ? 'where' : 'which';
  const result = await runCommand(locateCommand, ['node']);

  if (!result.success) {
    return {
      name: 'node-path',
      label: 'Node.js PATH Configuration',
      status: 'fail',
      message: 'Node.js was not found on the system PATH.',
      detail:
        'The PATH is an environment variable that tells your operating system where to ' +
        'look for executable programs. When you type "node" in a terminal, the OS searches ' +
        'through each directory listed in PATH (in order) until it finds a matching executable. ' +
        'If Node.js is installed but not on the PATH, you would need to type the full path ' +
        'to the node executable every time you want to use it.',
      suggestion: isWindows
        ? 'Add the Node.js installation directory to your PATH:\n' +
          '1. Open System Properties → Advanced → Environment Variables\n' +
          '2. Under "System variables", find and select "Path"\n' +
          '3. Click "Edit" and add the Node.js installation directory\n' +
          '   (typically C:\\Program Files\\nodejs)\n' +
          '4. Restart your terminal for the changes to take effect.'
        : 'Add Node.js to your PATH by adding this line to your shell profile ' +
          '(~/.bashrc, ~/.zshrc, or ~/.profile):\n' +
          'export PATH="/usr/local/bin:$PATH"\n' +
          'Then run: source ~/.bashrc (or your profile file)',
    };
  }

  const nodePaths = result.stdout
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  const primaryPath = nodePaths[0];

  if (nodePaths.length > 1) {
    return {
      name: 'node-path',
      label: 'Node.js PATH Configuration',
      status: 'warn',
      message: `Node.js found at multiple locations (${nodePaths.length} entries).`,
      detail:
        'Multiple Node.js installations were found on your PATH:\n' +
        nodePaths.map((p, i) => `  ${i + 1}. ${p}`).join('\n') +
        '\n\n' +
        'When multiple versions exist, the OS uses the one it finds FIRST in the PATH ' +
        'order. This can lead to confusion if different terminals or tools pick up ' +
        'different versions. This commonly happens when Node.js is installed both ' +
        'directly and through a version manager like nvm.',
      suggestion:
        'Consider removing duplicate installations or using a version manager (like nvm) ' +
        'to manage Node.js versions centrally. This ensures consistent behavior across ' +
        'all terminals and tools.',
    };
  }

  return {
    name: 'node-path',
    label: 'Node.js PATH Configuration',
    status: 'pass',
    message: `Node.js is on the PATH at: ${primaryPath}`,
    detail:
      `Node.js is properly configured and accessible from: ${primaryPath}\n\n` +
      'The PATH environment variable is correctly set up, meaning you can run Node.js ' +
      'commands from any directory in your terminal without specifying the full path ' +
      'to the executable.',
  };
}
