/**
 * Node.js Permissions Check
 *
 * Checks whether the current user can write to the global npm prefix
 * directory and whether npm global installs will require elevation.
 *
 * What this teaches:
 * - Why `npm install -g` sometimes demands sudo/admin
 * - The npm prefix and how to change it to avoid permission issues
 * - How to use `npm config get prefix` to find the global install location
 */

import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { checkFileAccess } from '../../../infra/system/permissions-checker.js';
import { runCommand } from '../../../infra/os/command-runner.js';

/**
 * Resolve the npm global prefix directory.
 * Returns undefined if npm is not installed or the command fails.
 */
async function getNpmPrefix(): Promise<string | undefined> {
  const result = await runCommand('npm', ['config', 'get', 'prefix']);
  if (result.success && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return undefined;
}

/**
 * Check whether the current user can write to npm's global prefix directory.
 */
export async function checkNodePermissions(): Promise<DiagnosticCheck> {
  const prefix = await getNpmPrefix();

  if (!prefix) {
    return {
      name: 'node-permissions',
      label: 'npm Global Permissions',
      status: 'skip',
      message: 'npm is not available — global prefix could not be determined.',
      detail:
        'This check requires npm to determine where globally installed packages are ' +
        'stored. Since npm was not found, this check was skipped.',
    };
  }

  const access = checkFileAccess(prefix);

  if (access.writable) {
    return {
      name: 'node-permissions',
      label: 'npm Global Permissions',
      status: 'pass',
      message: `npm global prefix is writable: ${prefix}`,
      detail:
        `The directory where npm installs global packages (${prefix}) is writable ` +
        'by your current user. This means you can run `npm install -g <package>` ' +
        'without administrator privileges or sudo, which is the recommended setup.\n\n' +
        'If the prefix is inside a system directory (like C:\\Program Files), npm global ' +
        'installs would require elevation. Since yours is accessible, you have a ' +
        'well-configured Node.js environment.',
    };
  }

  if (access.readable) {
    return {
      name: 'node-permissions',
      label: 'npm Global Permissions',
      status: 'warn',
      message: `npm global prefix is read-only for current user: ${prefix}`,
      detail:
        `The npm global prefix directory (${prefix}) exists and is readable, but your ` +
        'current user does not have write access. This means `npm install -g` commands ' +
        'will fail with a permissions error unless run with elevated privileges.\n\n' +
        'This commonly happens when Node.js is installed system-wide (e.g., via the ' +
        'official MSI installer on Windows) and the user account is not an administrator.',
      suggestion:
        process.platform === 'win32'
          ? 'Option 1: Re-run the terminal as Administrator for global installs.\n' +
            'Option 2: Change the npm prefix to a user-writable directory:\n' +
            '  mkdir %APPDATA%\\npm-global\n' +
            '  npm config set prefix "%APPDATA%\\npm-global"\n' +
            '  Add %APPDATA%\\npm-global to your PATH.'
          : 'Option 1: Fix ownership: sudo chown -R $(whoami) $(npm config get prefix)\n' +
            'Option 2: Use nvm to manage Node.js — nvm installs are always user-writable.',
    };
  }

  return {
    name: 'node-permissions',
    label: 'npm Global Permissions',
    status: 'fail',
    message: `npm global prefix directory is not accessible: ${prefix}`,
    detail:
      `The npm global prefix directory (${prefix}) cannot be read or written by the ` +
      'current user. This is an unusual state that may indicate the directory was ' +
      'deleted, a broken installation, or extreme permission restrictions.',
    suggestion:
      'Reinstall Node.js from https://nodejs.org or verify that the npm prefix ' +
      'directory exists and your user account has access to it.',
  };
}
