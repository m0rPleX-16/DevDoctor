# ADR 0009 — Security Hardening: Command Injection, Path Traversal, and Process Safety

**Date:** 2026-07-13  
**Status:** Accepted

---

## Context

A security review identified several classes of risk in the initial implementation:

1. **Shell injection on Windows** — `command-runner.ts` uses `exec()` (shell mode) on Windows
   and builds the command string with a simple space-quote heuristic. Arguments containing
   shell metacharacters (`&`, `|`, `>`, `<`, `^`, `` ` ``) could break out of the intended
   command and execute arbitrary shell instructions.

2. **Path traversal via `--output` and `reportOutputDir`** — The `writeReport()` helper and
   the `--output` CLI flag resolve paths without any containment check. A malicious
   `devdoctor.json` checked into a project repository could set
   `"reportOutputDir": "../../../../etc/"` and cause the tool to write files outside the
   intended working tree when a developer runs `diagnose --output report.json`.

3. **Process name injection in `tasklist` filter** — `findWindowsProcess()` interpolates
   `processName` directly into the `/fi "IMAGENAME eq <name>"` argument. If the name ever
   originates from an untrusted source (config file, dynamic plugin), shell metacharacters
   in the name could manipulate the `tasklist` output filter.

4. **PID recycling race in port-conflict repair** — The MySQL plugin's `mysql-port` repair
   reads a PID from `getPortOwner()` and immediately issues `taskkill /f /pid <pid>`. The
   PID could be reused by an unrelated process between those two calls, causing the wrong
   process to be killed.

5. **Unconditional `sudo` on Unix repair** — The repair path unconditionally prepends
   `sudo` to `systemctl` calls on non-Windows platforms. On machines that require a TTY
   password prompt for `sudo`, this hangs indefinitely since Dev Doctor does not provide
   a TTY for the child process.

6. **Spawned `mysqld` has no start-up probe** — `spawnDetached()` returns immediately and
   a fixed 2-second `setTimeout` is used before verification. If `mysqld` hangs at startup
   (e.g., corrupt data directory), the 2-second window passes, verification fails, and a
   rollback is triggered against a process that may still be starting up.

---

## Decisions

### 1. Sanitize shell arguments — strip metacharacters before `exec()` on Windows

Rather than switching entirely to `execFile()` on Windows (which breaks `.cmd` shims that
Node.js requires on that platform), all arguments passed through the shell-mode code path
are sanitized by stripping the characters that are meaningful to `cmd.exe`:
`` & | < > ^ ` " \n \r ``.

A safe `sanitizeArg()` helper is added to `command-runner.ts` and applied to every element
of `args` before the shell command string is assembled. This is a defence-in-depth measure;
all callers are also expected to pass only trusted, static argument values.

### 2. Path containment check in `writeReport()`

`writeReport()` now resolves the output path to an absolute path and asserts it begins with
an allowed prefix — either the explicit `outputDir` argument or `process.cwd()`. If the
resolved path escapes the allowed root, the write is rejected with a clear error message
rather than silently writing to a potentially dangerous location.

### 3. Allowlist for process names passed to `tasklist /fi`

`findWindowsProcess()` validates `processName` against the pattern
`/^[\w.\-]+\.exe$/i` (alphanumeric, dash, dot, must end in `.exe`) before constructing
the `tasklist` filter argument. Invalid names are rejected immediately and
`ProcessInfo { running: false }` is returned, matching the existing failure contract.

### 4. Cross-check PID before killing in `mysql-port` repair

Before issuing `taskkill` (Windows) or `kill -9` (Unix), the repair code re-queries the
port owner and verifies the PID and process name still match. If the PID has been recycled
(process name no longer matches the one found during diagnosis), the kill is skipped and
a descriptive error is returned instead.

### 5. Elevation-aware repair on Unix — detect sudo availability before using it

Before prepending `sudo` on Unix, the repair logic checks whether the current process is
already running as root (`process.getuid() === 0`). If it is, `sudo` is omitted. If it is
not root, `sudo -n` (non-interactive) is used instead of plain `sudo`, which causes `sudo`
to fail immediately with a clear error rather than hanging for a password prompt. The error
message tells the user to re-run with elevated privileges.

### 6. TCP-probe for `mysqld` startup instead of fixed sleep

After `spawnDetached()`, the code now polls TCP port 3306 (or the configured port) with
a short-interval retry loop (100 ms intervals, up to 10 seconds) using a raw `net.connect`.
If the port becomes reachable within the window, verification proceeds immediately rather
than waiting the full duration. If the timeout expires, the repair is marked as failed.

---

## Consequences

- **Positive:** Eliminates the primary shell-injection and path-traversal attack surfaces.
  PID-recycling kill race is mitigated. Unix repair no longer hangs on interactive `sudo`.
- **Positive:** Startup probe is strictly more reliable than a fixed sleep for both fast
  and slow machines.
- **Neutral:** The process name allowlist for `tasklist` restricts names to the `.exe`
  convention; non-`.exe` Windows process names are not currently used in the codebase, so
  no callers are affected.
- **Trade-off:** `exec()` shell mode is retained on Windows because `execFile()` cannot
  invoke `.cmd` shims. The sanitization approach accepts this constraint while closing the
  most practical injection vectors.
