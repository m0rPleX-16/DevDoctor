/**
 * Command Runner
 *
 * A safe wrapper around Node.js child_process for executing system commands.
 *
 * This is a critical infrastructure component — Dev Doctor needs to run
 * commands like `node --version`, `net start`, `docker ps`, etc.
 * Wrapping this in a dedicated module provides:
 *
 * 1. **Safety** — Timeout protection prevents hanging processes
 * 2. **Consistency** — Structured output regardless of command success/failure
 * 3. **Testability** — Easy to mock in unit tests
 * 4. **Transparency** — Follows the "show what you're executing" principle
 *
 * Security note (ADR-0009):
 * On Windows, many commands (npm, npx, etc.) are .cmd batch files that require
 * shell execution. We retain exec() shell mode on Windows but sanitize all
 * arguments before building the command string to prevent shell metacharacter
 * injection. On Unix, execFile() is used without a shell.
 *
 * Architecture note:
 * This lives in the Infrastructure layer. It's the only layer that
 * directly interacts with the operating system's process APIs.
 */

import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

/**
 * The structured result of running a system command.
 */
export interface CommandResult {
  /** The command that was executed */
  command: string;

  /** Arguments passed to the command */
  args: string[];

  /** Standard output (trimmed) */
  stdout: string;

  /** Standard error output (trimmed) */
  stderr: string;

  /** Process exit code (0 = success) */
  exitCode: number;

  /** Whether the command completed successfully (exitCode === 0) */
  success: boolean;

  /** How long the command took in milliseconds */
  durationMs: number;
}

/**
 * Options for running a command.
 */
export interface CommandOptions {
  /** Maximum time to wait for the command to complete (default: 10000ms) */
  timeoutMs?: number;

  /** Working directory for the command */
  cwd?: string;

  /** Use shell execution (default: false for security) */
  shell?: boolean;
}

// ── Security: argument sanitization ──────────────────────────────

/**
 * Characters that are meaningful to cmd.exe and could enable shell injection.
 * We strip these when building the shell command string on Windows.
 *
 * ADR-0009: The stripping approach is used rather than allowlisting so that
 * legitimate paths with spaces are not broken. Only genuine metacharacters
 * that have no place in the argument values we construct are removed.
 */
const WINDOWS_SHELL_METACHARACTERS = /[&|<>^`\n\r]/g;

/**
 * Sanitize a single argument for safe inclusion in a Windows shell command string.
 *
 * - Strips cmd.exe metacharacters that could break out of the intended command.
 * - Wraps in double quotes if the argument contains spaces.
 * - Escapes any remaining double quotes inside the value.
 *
 * @param arg - The raw argument string
 */
function sanitizeWindowsArg(arg: string): string {
  // Strip shell metacharacters
  const clean = arg.replace(WINDOWS_SHELL_METACHARACTERS, '');

  // Escape internal double quotes, then wrap if spaces present
  const escaped = clean.replace(/"/g, '\\"');
  return escaped.includes(' ') ? `"${escaped}"` : escaped;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Execute a system command safely and return a structured result.
 *
 * This function NEVER throws. If the command fails, times out, or
 * doesn't exist, it returns a CommandResult with success=false.
 *
 * @param command - The executable to run (e.g., "node", "git")
 * @param args - Arguments to pass (e.g., ["--version"])
 * @param options - Execution options
 * @returns A structured result with stdout, stderr, and exit code
 *
 * @example
 * ```typescript
 * const result = await runCommand('node', ['--version']);
 * if (result.success) {
 *   console.log(`Node version: ${result.stdout}`);
 * }
 * ```
 */
export async function runCommand(
  command: string,
  args: string[] = [],
  options: CommandOptions = {},
): Promise<CommandResult> {
  // On Windows, many commands (npm, npx, etc.) are .cmd batch files
  // that require shell execution. Default to shell: true on Windows.
  const isWindows = process.platform === 'win32';
  const { timeoutMs = 10_000, cwd, shell = isWindows } = options;
  const startTime = performance.now();

  try {
    const execOptions = { timeout: timeoutMs, cwd, windowsHide: true };

    const { stdout, stderr } = shell
      ? // Shell mode (Windows): sanitize args before building command string (ADR-0009)
        await execAsync(
          [command, ...args.map(sanitizeWindowsArg)].join(' '),
          execOptions,
        )
      : // Non-shell mode (Unix): execFile avoids the shell entirely
        await execFileAsync(command, args, {
          ...execOptions,
          shell: false,
        });

    const durationMs = Math.round(performance.now() - startTime);

    return {
      command,
      args,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      success: true,
      durationMs,
    };
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - startTime);

    // Node.js exec errors include stdout/stderr and exit code
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      killed?: boolean;
    };

    return {
      command,
      args,
      stdout: (execError.stdout ?? '').toString().trim(),
      stderr:
        (execError.stderr ?? (error instanceof Error ? error.message : '')).toString().trim(),
      exitCode: typeof execError.code === 'number' ? execError.code : 1,
      success: false,
      durationMs,
    };
  }
}
