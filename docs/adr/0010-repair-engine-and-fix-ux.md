# ADR 0010 — Repair Engine, Non-Interactive Mode, and Concurrent Diagnostics

**Date:** 2026-07-13  
**Status:** Accepted

---

## Context

Three related concerns emerged from the review:

1. **The `fix` command bypasses the DiagnosticEngine** — `fix.ts` imports the
   `PluginRegistry` directly and calls `plugin.repair()`, while all diagnostic calls go
   through `DiagnosticEngine`. Cross-cutting concerns added to the engine (timeouts, audit
   hooks, error wrapping) do not apply to repairs. The repair path is also harder to unit
   test because the orchestration logic is embedded inside the Commander action callback.

2. **`runAll()` in DiagnosticEngine is sequential** — The engine uses a `for...of` loop
   with `await` for each plugin, serializing what could be concurrent work. With many
   plugins this scales linearly with plugin count. The `doctor` command already calls
   `engine.runAll()` and `detectTools()` concurrently at the outer level, but the inner
   plugin loop is still sequential.

3. **`fix` is unusable in CI / scripted environments** — The readline confirmation prompt
   blocks forever when stdin is not an interactive TTY, making the command unusable in
   automated pipelines. There is also no way to preview what would be repaired without
   actually doing it.

4. **No per-plugin timeout during `runAll()`** — A misbehaving plugin check that hangs
   indefinitely blocks the entire `doctor` command. There is no mechanism to time out an
   individual plugin and continue with the rest.

---

## Decisions

### 1. Introduce `RepairEngine` in the Core layer

A new `RepairEngine` class is added to `src/core/engine/repair-engine.ts`. It mirrors
`DiagnosticEngine` in design: it accepts a `PluginRegistry`, exposes
`runRepair(pluginName, checkName)` and `runVerification(pluginName, checkName)`, and wraps
plugin errors in structured `RepairResult` / `VerificationResult` objects rather than
allowing them to propagate. The `fix` command is updated to use `RepairEngine` exclusively.

### 2. `runAll()` uses `Promise.allSettled()` for concurrency

`DiagnosticEngine.runAll()` is changed to dispatch all plugin `diagnose()` calls
concurrently via `Promise.allSettled()`. A rejected promise (plugin crash) is converted to
a `plugin-error` fail result rather than killing the entire run. This matches the error
handling contract already present in `runDiagnostics()`.

### 3. Per-plugin timeout in `runAll()`

`DiagnosticEngine.runAll()` wraps each plugin call in a `Promise.race()` against a
configurable timeout (default: 30 seconds). On timeout, the plugin's result is replaced
with a `skip` result containing a timeout message, and the remaining plugins complete
normally.

### 4. `fix --yes` / `fix --dry-run`

Two new flags are added to the `fix` command:

- `--yes` / `-y`: Skips all readline confirmation prompts and applies every repairable fix
  automatically. Intended for CI pipelines and scripted environments. When stdin is not a
  TTY and `--yes` is not provided, the command fails fast with a clear error rather than
  hanging.
- `--dry-run`: Runs diagnostics and lists the repairs that *would* be applied, but does not
  call `plugin.repair()`. Combines cleanly with `--yes` for pipeline smoke tests:
  `devdoctor fix mysql --dry-run --yes` exits with code 1 if any issues exist.

### 5. TTY detection guard

When neither `--yes` nor `--dry-run` is provided and `process.stdin.isTTY` is `false`,
the `fix` command prints an error message and exits with code 1. This prevents silent
hanging in non-interactive environments where no human can answer the prompts.

---

## Consequences

- **Positive:** Repairs now go through a proper engine layer, enabling consistent
  error handling and future cross-cutting concerns (audit logging, telemetry).
- **Positive:** `doctor` command is faster with concurrent plugin execution.
- **Positive:** `fix` is usable in CI with `--yes`, and `--dry-run` enables pipeline
  health checks without side effects.
- **Trade-off:** `Promise.allSettled()` in `runAll()` means all plugins always run —
  there is no early-exit on the first failure. This is the correct behavior for a
  diagnostic tool (show the full picture) but is a change from the implicit sequential
  behavior.
