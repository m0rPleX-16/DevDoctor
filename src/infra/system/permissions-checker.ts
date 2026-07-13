/**
 * Permissions Checker
 *
 * Detects whether the current process has elevated privileges and whether
 * specific file paths are readable/writable.
 *
 * What this teaches:
 * - How OS privilege levels work (admin/root vs normal user)
 * - Why some repair operations require elevation
 * - How to test file access without throwing exceptions
 */

import fs from 'node:fs';
import { runCommand } from '../os/command-runner.js';

export interface ElevationStatus {
  /** Whether the current process is running as admin/root */
  isElevated: boolean;
  /** How elevation was determined */
  method: 'id' | 'net-session' | 'unknown';
}

export interface FileAccessResult {
  path: string;
  readable: boolean;
  writable: boolean;
}

/**
 * Determine whether the current process is running with elevated privileges.
 *
 * On Windows: attempts `net session` (succeeds only for administrators).
 * On Unix: checks if effective UID is 0 (root).
 */
export async function checkElevation(): Promise<ElevationStatus> {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // `net session` exits with code 0 only when the caller is an administrator.
    // Non-admins receive "System error 5 — Access is denied."
    const result = await runCommand('net', ['session'], { timeoutMs: 5_000 });
    return {
      isElevated: result.success,
      method: 'net-session',
    };
  }

  // On Unix, `id -u` returns the effective UID. 0 = root.
  const result = await runCommand('id', ['-u'], { timeoutMs: 3_000 });
  if (result.success) {
    return {
      isElevated: result.stdout.trim() === '0',
      method: 'id',
    };
  }

  return { isElevated: false, method: 'unknown' };
}

/**
 * Test read and write access for a specific file or directory path.
 * Uses fs.accessSync with appropriate constants — never throws.
 *
 * @param filePath - The path to test
 * @param accessSync - Injectable accessor for testing (defaults to fs.accessSync)
 */
export function checkFileAccess(
  filePath: string,
  accessSync: (p: string, mode: number) => void = fs.accessSync,
): FileAccessResult {
  let readable = false;
  let writable = false;

  try {
    accessSync(filePath, fs.constants.R_OK);
    readable = true;
  } catch {
    // Not readable
  }

  try {
    accessSync(filePath, fs.constants.W_OK);
    writable = true;
  } catch {
    // Not writable
  }

  return { path: filePath, readable, writable };
}
