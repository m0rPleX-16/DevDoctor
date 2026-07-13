/**
 * Process Manager
 *
 * Infrastructure utilities for managing long-running background processes.
 * Distinct from command-runner.ts, which is for commands that terminate.
 *
 * What this teaches:
 * - The difference between exec (wait for exit) and spawn (fire and forget)
 * - How detached processes work: a child that outlives its parent
 * - Why unref() is necessary to let the Node.js event loop exit
 * - How to check for running processes by name on Windows and Unix
 *
 * Architecture note:
 * Lives in the Infrastructure layer. Only this file interacts with
 * child_process.spawn for long-lived processes. All other code uses
 * command-runner.ts or this module — never child_process directly.
 */

import { spawn } from 'node:child_process';
import { runCommand } from './command-runner.js';

// ── Types ─────────────────────────────────────────────────────────

export interface SpawnResult {
  /** Whether the process was successfully spawned (not whether it succeeded) */
  spawned: boolean;
  /** The PID of the spawned process, if available */
  pid?: number;
  /** Error message if spawning failed */
  error?: string;
}

export interface ProcessInfo {
  /** Whether at least one process with this name is running */
  running: boolean;
  /** PIDs of matching processes */
  pids: number[];
  /** The process name that was searched */
  processName: string;
}

// ── Spawn ─────────────────────────────────────────────────────────

/**
 * Spawn a background process that continues running after Dev Doctor exits.
 *
 * Uses `detached: true` so the child is promoted to its own process group —
 * it won't be killed when the parent process exits. Calling `unref()` on the
 * child handle tells Node.js not to keep the event loop alive waiting for it.
 *
 * This is the correct approach for starting daemon-style processes like
 * mysqld.exe or redis-server.
 *
 * @param executable  - Absolute path to the executable
 * @param args        - Arguments to pass
 * @param cwd         - Working directory for the process
 */
export function spawnDetached(
  executable: string,
  args: string[] = [],
  cwd?: string,
): SpawnResult {
  try {
    const child = spawn(executable, args, {
      detached: true,
      stdio: 'ignore',    // Don't inherit stdio — daemon has no terminal
      cwd,
      windowsHide: true,  // Don't flash a console window on Windows
    });

    // Detach the child from the parent's event loop.
    // Without this, Node.js would wait for the child to exit before it exits,
    // which defeats the point of spawning a background daemon.
    child.unref();

    return { spawned: true, pid: child.pid };
  } catch (err) {
    return {
      spawned: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Process detection ─────────────────────────────────────────────

/**
 * Check whether a process with the given executable name is currently running.
 *
 * On Windows: uses `tasklist /fi "IMAGENAME eq <name>"` which outputs a table
 * of matching processes.
 *
 * On Unix: uses `pgrep -x <name>` which outputs PIDs of exact-name matches.
 *
 * @param processName - The executable name to search for (e.g. "mysqld.exe" or "mysqld")
 */
export async function findRunningProcess(processName: string): Promise<ProcessInfo> {
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      return await findWindowsProcess(processName);
    } else {
      return await findUnixProcess(processName);
    }
  } catch {
    return { running: false, pids: [], processName };
  }
}

async function findWindowsProcess(processName: string): Promise<ProcessInfo> {
  // tasklist /fi filters by image name; /nh suppresses the header line;
  // /fo csv gives parseable output.
  const result = await runCommand(
    'tasklist',
    ['/fi', `IMAGENAME eq ${processName}`, '/nh', '/fo', 'csv'],
    { timeoutMs: 8_000 },
  );

  if (!result.success || result.stdout.includes('No tasks')) {
    return { running: false, pids: [], processName };
  }

  // CSV format: "mysqld.exe","1234","Services","0","45,212 K"
  const pids: number[] = [];
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('"Image')) continue;

    // Extract PID from second CSV column
    const columns = trimmed.split('","');
    if (columns.length >= 2) {
      const pid = parseInt(columns[1].replace(/"/g, ''), 10);
      if (!isNaN(pid) && pid > 0) pids.push(pid);
    }
  }

  return { running: pids.length > 0, pids, processName };
}

async function findUnixProcess(processName: string): Promise<ProcessInfo> {
  // pgrep -x matches exact process names; -d ',' joins multiple PIDs
  const result = await runCommand('pgrep', ['-x', processName], { timeoutMs: 5_000 });

  if (!result.success || !result.stdout.trim()) {
    return { running: false, pids: [], processName };
  }

  const pids = result.stdout
    .trim()
    .split(/[\n,]/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  return { running: pids.length > 0, pids, processName };
}
