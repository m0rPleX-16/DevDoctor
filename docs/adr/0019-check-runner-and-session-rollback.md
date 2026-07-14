# ADR-0019 — Dependency-Aware Check Runner and Session Rollback

**Status:** Accepted  
**Date:** 2026-07-14  
**Deciders:** Dev Doctor maintainers

---

## Context

Two separate issues surfaced during the 0.4.x cycle that both required
structural changes to how checks are scheduled and how repairs are undone.

### Issue 1 — Duplicate dependency resolution strategies

The `applyDependencySkips()` utility in `status-utils.ts` (ADR-0017) resolves
dependencies *after* all checks have already run. A check that depends on a
failed upstream check still executes — it just gets replaced with a `skip` in
post-processing. This is wasteful and can produce misleading intermediate errors
when a downstream check throws because its prerequisite data was never populated
(e.g. `mysql-port` requiring a port number from `mysql-config`).

Git and Node adopted the post-hoc approach when they migrated to structured
tasks in 0.4.x. Python adopted the same `applyDependencySkips()` path but
continued running all checks concurrently regardless of dependency status.

Three plugins, three subtly different execution models.

### Issue 2 — No way to undo an entire repair session

The `devdoctor rollback <plugin> <check>` command (ADR-0015) rolls back a
single known check. After a `devdoctor fix` session that repaired multiple
checks, users had no way to undo all repairs at once — they would need to
manually issue one rollback per check, knowing each check name.

---

## Decision

### 1 — Centralise execution in `CheckRunner` (`check-runner.ts`)

Introduce `runDiagnosticTasks(tasks: DiagnosticTask[])` in
`src/core/engine/check-runner.ts`. This function:

- Accepts an ordered list of `DiagnosticTask` objects (defined on `DiagnosticResult`
  via the new `DiagnosticTask` interface in `diagnostic.ts`).
- Executes a dependency-aware loop: tasks whose dependencies have all passed run
  concurrently in each round; tasks with a failed dependency are immediately
  marked `skip` without invoking their `run()` function.
- Cascades skip status — a skipped task is treated as a failed dependency for
  anything that depends on it.
- Detects circular or unresolvable dependency graphs and marks remaining tasks as
  `skip` rather than looping forever.

All five plugins (`node`, `mysql`, `git`, `redis`, `python`) now use this single
runner. `applyDependencySkips()` remains in `status-utils.ts` for backward
compatibility but is no longer used by any built-in plugin.

**Why not remove `applyDependencySkips()`?** It is part of the public API surface
used by snapshot tests and could be used by external/dynamic plugins. Removing it
would be a breaking change with no immediate benefit.

### 2 — Snapshot-based session rollback

Introduce `SnapshotManager` (`src/core/engine/snapshot-manager.ts`):

- After every successful repair where `rollbackSupported: true`, `RepairEngine`
  calls `snapshotManager.recordRepair(plugin, checkName)`.
- The snapshot is persisted as JSON to `~/.devdoctor/snapshots/latest.json`.
- `RepairEngine.rollbackAll()` reads the latest snapshot, rolls back each repair
  in **reverse order**, then deletes the snapshot file.

`devdoctor rollback` (no arguments) triggers `rollbackAll()`. With arguments, the
existing single-check path is unchanged.

**Why persist to disk?** The snapshot must survive process restarts. A user may
run `devdoctor fix` in one terminal session and `devdoctor rollback` in another.
An in-memory snapshot would not survive that workflow.

**Why only one snapshot?** The common case is "I just ran fix, let me undo it."
Keeping only the latest snapshot keeps the implementation simple and the storage
footprint minimal. Full repair history is already covered by the audit log
(ADR-0011).

### 3 — Auto-elevation fallback in MySQL repair

Repair and rollback operations in the MySQL plugin previously failed with a
"run as administrator" error message when elevation was required. They now
attempt the operation with standard privileges first; on receiving a `System
error 5` (Windows) or `Elevation required` error, they automatically retry via
`runElevatedCommand()` from `command-runner.ts`.

`runElevatedCommand()` uses `PowerShell Start-Process -Verb RunAs` on Windows
(triggers a UAC prompt) and `sudo` on Unix.

### 4 — Two new Git checks

`checkCrlf` (`git-crlf`) — warns when `core.autocrlf` is not set or is set to
a value inappropriate for the current platform (Windows expects `true`,
Unix expects `input` or `false`).

`checkCredentialHelper` (`git-credential-helper`) — warns when no global
credential helper is configured, which typically causes repeated password prompts.

Both depend on `git-installation` and participate in the `runDiagnosticTasks`
dependency graph.

---

## Consequences

**Positive:**
- All plugins use one execution model. Dependency resolution now happens
  *before* a check runs, not as a post-hoc replacement. Checks that depend on
  configuration data (like `mysql-port` needing the port number from
  `mysql-config`) can safely rely on that data being present.
- `devdoctor rollback` with no arguments undoes an entire session in one command,
  making it practical for automated fix pipelines.
- MySQL repair no longer surfaces confusing "run as admin" errors on Windows;
  it escalates automatically and surfaces the UAC dialog directly to the user.
- Git plugin covers two additional common configuration issues.

**Negative / Trade-offs:**
- `SnapshotManager` writes to `~/.devdoctor/snapshots/latest.json`. On
  read-only home directories (some CI environments) this will fail silently —
  the snapshot is not written and `rollbackAll()` returns an empty result.
  This is acceptable; session rollback is a user-facing feature, not a CI one.
- The snapshot records only the plugin and check name, not the pre-repair state.
  `rollbackAll()` assumes each plugin's `rollback()` implementation knows how
  to restore state (e.g. reading `npm-rollback-prefix.txt`). This is consistent
  with the existing single-check rollback design.
- `runElevatedCommand()` on Windows embeds the command and arguments into a
  PowerShell string. Currently all callers pass internally-generated values
  (service names from a fixed constants list, PIDs from `findRunningProcess`),
  so injection risk is low. Future callers must validate inputs before passing
  them to this function.
