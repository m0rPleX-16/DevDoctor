# ADR-0020 — Clean Command

**Status:** Accepted  
**Date:** 2026-07-14  
**Deciders:** Dev Doctor maintainers

---

## Context

Dev Doctor accumulates persistent state in `~/.devdoctor/` across multiple
sessions:

| File | Created by | Purpose |
|---|---|---|
| `snapshots/latest.json` | `devdoctor fix` | Records repairs for session rollback |
| `runs.json` | `devdoctor doctor` | Health score timeline for `devdoctor history` |
| `history.json` | `devdoctor fix` | NDJSON repair audit log |
| `fix.lock` | `devdoctor fix` | Prevents concurrent fix runs |

These files are never automatically pruned. This creates three user-facing
problems:

1. **Stale snapshot** — if `devdoctor fix` crashes mid-session, `latest.json`
   may contain a partial repair list. Running `devdoctor rollback` against it
   would attempt to roll back repairs that were never fully applied.

2. **Stale lockfile** — if `devdoctor fix` crashes, `fix.lock` remains on disk
   with the dead process's PID. The next `fix` run checks whether the PID is
   still alive and clears stale locks automatically, but users who encounter the
   error message have no clean manual recovery path other than knowing the file
   path and deleting it manually.

3. **History reset** — developers starting fresh on a machine, or sharing a
   health report baseline, want to clear accumulated history without deleting
   the entire `~/.devdoctor/` directory.

---

## Decision

Add `devdoctor clean <subcommand>` with five targeted subcommands:

| Subcommand | Deletes |
|---|---|
| `snapshot` | `~/.devdoctor/snapshots/latest.json` |
| `history` | `~/.devdoctor/runs.json` |
| `audit` | `~/.devdoctor/history.json` |
| `lock` | `~/.devdoctor/fix.lock` |
| `all` | All of the above |

### Interaction design

- **Confirmation required** — every subcommand shows what will be deleted and
  asks for confirmation before acting, unless `--yes` is passed. Consistent
  with `fix` and `rollback`.
- **Absent files are reported, not errored** — if a target file doesn't exist,
  the command reports it as "not found — will be skipped" and exits cleanly.
  This makes `clean` safe to run idempotently in scripts.
- **Snapshot warning** — `clean snapshot` and `clean all` display an explicit
  warning that deleting the snapshot makes any pending repairs permanent, since
  `devdoctor rollback` (no-args) will have nothing to undo.
- **Per-plugin rollback artifacts excluded** — files like
  `npm-rollback-prefix.txt` are intentionally not touched. They are owned by
  individual plugin rollback implementations and are cleaned up naturally when
  rollback runs. Removing them via `clean` would silently break pending rollbacks.

### Interactive menu

`devdoctor clean` is added to the interactive arrow-key menu under
"◇ Clean state files", with a sub-choice prompt listing all five targets.

---

## Consequences

**Positive:**
- Users have a documented, safe escape hatch for all common stuck-state
  scenarios without needing to know or remember file paths.
- `clean lock` gives users a clear recovery path when a stale lock error is
  shown, replacing the current "delete `~/.devdoctor/fix.lock` manually" note.
- All deletions are explicit and confirmed — no accidental data loss.

**Negative / Trade-offs:**
- `clean audit` and `clean history` are destructive and irreversible. The
  confirmation prompt and `--yes` requirement mitigate accidental use, but
  there is no undo. This is consistent with the existing behaviour of the
  audit log and history store, which never modify or restore entries.
- The command does not recurse into plugin-specific artifacts under
  `~/.devdoctor/` (e.g. `npm-rollback-prefix.txt`). A user who explicitly
  wants to clean those must still do so manually. This is a deliberate boundary
  — `clean` manages infrastructure state, not plugin state.
