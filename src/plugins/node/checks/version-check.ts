/**
 * Node.js Version Check
 *
 * Checks whether Node.js is installed and reports its version.
 *
 * What this teaches:
 * - How to detect installed software by running version commands
 * - How Node.js versioning works (major.minor.patch / semver)
 * - The difference between LTS and Current releases
 */

import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

/**
 * Check if Node.js is installed and get its version.
 */
export async function checkNodeVersion(): Promise<DiagnosticCheck> {
  const result = await runCommand('node', ['--version']);

  if (!result.success) {
    return {
      name: 'node-version',
      label: 'Node.js Installation',
      status: 'fail',
      message: 'Node.js is not installed or not found on the system PATH.',
      detail:
        'Node.js is a JavaScript runtime that allows you to run JavaScript outside ' +
        'of a web browser. It is required for most modern web development workflows, ' +
        'including running build tools, package managers, and development servers.',
      suggestion:
        'Install Node.js from https://nodejs.org. The LTS (Long Term Support) version ' +
        'is recommended for most developers. Alternatively, use a version manager like ' +
        'nvm-windows (https://github.com/coreybutler/nvm-windows) to manage multiple versions.',
    };
  }

  const version = result.stdout.trim();

  // Extract major version number for LTS check
  const majorMatch = version.match(/^v(\d+)/);
  const major = majorMatch ? parseInt(majorMatch[1], 10) : 0;

  // Even-numbered major versions are LTS
  const isLts = major % 2 === 0;
  const isOld = major < 18;

  if (isOld) {
    return {
      name: 'node-version',
      label: 'Node.js Version',
      status: 'warn',
      message: `Node.js ${version} is installed, but it may be outdated.`,
      detail:
        `You are running Node.js ${version}. Node.js follows a release schedule where ` +
        'even-numbered versions (18, 20, 22) receive Long Term Support (LTS), meaning ' +
        'they get security updates and bug fixes for 30 months. Odd-numbered versions ' +
        'are "Current" releases with a shorter support window.',
      suggestion:
        'Consider upgrading to the latest LTS version for better security and compatibility. ' +
        'Visit https://nodejs.org to download the latest LTS release.',
    };
  }

  return {
    name: 'node-version',
    label: 'Node.js Version',
    status: 'pass',
    message: `Node.js ${version} is installed.${isLts ? ' (LTS)' : ' (Current)'}`,
    detail:
      `Node.js ${version} is a ${isLts ? 'Long Term Support (LTS)' : 'Current'} release. ` +
      (isLts
        ? 'LTS versions receive security updates and bug fixes for 30 months, ' +
          'making them ideal for production use.'
        : 'Current releases include the latest features but have a shorter support window. ' +
          'Consider using an LTS version for production workloads.'),
  };
}
