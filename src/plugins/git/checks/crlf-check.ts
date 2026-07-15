/**
 * CRLF / Line-Ending Check
 *
 * What this teaches:
 * - Why line endings differ between Windows (CRLF) and Unix (LF)
 * - How `core.autocrlf` prevents cross-platform commit noise
 * - The difference between `true` (Windows) and `input` (Unix) settings
 */

import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

const CRLF_DETAIL =
  'Line endings are the invisible characters that mark the end of a line in a text file. ' +
  'Windows uses CRLF (\\r\\n, two characters) while Unix/macOS uses LF (\\n, one character). ' +
  'When developers on different operating systems collaborate, Git can silently introduce ' +
  'line-ending changes that pollute diffs and cause unnecessary merge conflicts. ' +
  '`core.autocrlf` tells Git how to handle this translation automatically on checkout and commit.';

export async function checkCrlf(): Promise<DiagnosticCheck> {
  const result = await runCommand('git', ['config', '--global', 'core.autocrlf']);
  const autocrlf = result.stdout.trim().toLowerCase();
  const isWindows = process.platform === 'win32';

  if (!result.success || !autocrlf) {
    return {
      name: 'git-crlf',
      label: 'Line Endings (core.autocrlf)',
      status: 'warn',
      message: 'Git core.autocrlf is not configured globally.',
      detail: CRLF_DETAIL,
      suggestion: isWindows
        ? 'Run: git config --global core.autocrlf true\n' +
          'On Windows, `true` converts LF to CRLF on checkout and CRLF back to LF on commit, ' +
          'so your working files use Windows line endings but the repository stores Unix endings.'
        : 'Run: git config --global core.autocrlf input\n' +
          'On macOS/Linux, `input` converts CRLF to LF on commit but never changes files on checkout, ' +
          'keeping the repository clean without altering your working files.',
    };
  }

  if (isWindows && autocrlf !== 'true') {
    return {
      name: 'git-crlf',
      label: 'Line Endings (core.autocrlf)',
      status: 'warn',
      message: `core.autocrlf is set to '${autocrlf}', but 'true' is recommended on Windows.`,
      detail: CRLF_DETAIL,
      suggestion:
        'Run: git config --global core.autocrlf true\n' +
        'This ensures Windows line endings in your working copy while keeping LF in the repository.',
    };
  }

  if (!isWindows && autocrlf === 'true') {
    return {
      name: 'git-crlf',
      label: 'Line Endings (core.autocrlf)',
      status: 'warn',
      message: `core.autocrlf is set to 'true', but 'input' or 'false' is recommended on Unix.`,
      detail: CRLF_DETAIL,
      suggestion:
        'Run: git config --global core.autocrlf input\n' +
        'On Unix systems, `true` would convert line endings unnecessarily. ' +
        '`input` is the safer choice: it converts CRLF to LF on commit only.',
    };
  }

  return {
    name: 'git-crlf',
    label: 'Line Endings (core.autocrlf)',
    status: 'pass',
    message: `Configured correctly (core.autocrlf = ${autocrlf}).`,
    detail:
      CRLF_DETAIL +
      '\n\n' +
      `Your setting (${autocrlf}) is appropriate for ${isWindows ? 'Windows' : 'Unix/macOS'}. ` +
      'Git will handle line-ending translation automatically, keeping your repository ' +
      'clean and collaboration friction-free.',
  };
}
