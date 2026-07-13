/**
 * npm Check
 *
 * Checks whether npm (Node Package Manager) is installed and reports its version.
 *
 * What this teaches:
 * - npm is bundled with Node.js but can be updated independently
 * - The role of a package manager in software development
 * - The relationship between Node.js and npm
 */

import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

/**
 * Check if npm is installed and get its version.
 */
export async function checkNpm(): Promise<DiagnosticCheck> {
  const result = await runCommand('npm', ['--version']);

  if (!result.success) {
    return {
      name: 'npm-version',
      label: 'npm Installation',
      status: 'fail',
      message: 'npm is not installed or not found on the system PATH.',
      detail:
        'npm (Node Package Manager) is the default package manager for Node.js. ' +
        'It allows you to install, share, and manage dependencies — third-party ' +
        'libraries and tools that your project needs. npm is normally installed ' +
        'automatically alongside Node.js.',
      suggestion:
        'If Node.js is installed but npm is missing, try reinstalling Node.js from ' +
        'https://nodejs.org. Make sure to check the "npm package manager" option during ' +
        'installation. You can also try running: `npm install -g npm` if Node.js is present.',
    };
  }

  const version = result.stdout.trim();

  return {
    name: 'npm-version',
    label: 'npm Version',
    status: 'pass',
    message: `npm ${version} is installed.`,
    detail:
      `npm v${version} is available on your system. npm is bundled with Node.js but can ` +
      'be updated independently using `npm install -g npm`. It manages your project\'s ' +
      'dependencies through the package.json file, which lists all the packages your ' +
      'project depends on.',
  };
}
