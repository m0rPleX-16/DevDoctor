# ADR 0011 — Repair Audit Log

**Date:** 2026-07-13  
**Status:** Accepted

---

## Context

When `devdoctor fix` applies a repair, there is currently no record of what was changed.
If a developer's environment breaks after running a fix, they have no way to know what
Dev Doctor modified. This makes debugging post-repair issues frustrating and reduces trust
in the tool.

A persistent audit trail also satisfies a common operational requirement: knowing *who*
ran a repair, *when*, and with what outcome, particularly useful for shared developer
machines or onboarding environments where multiple people may run Dev Doctor.

---

## Decision

An append-only audit log is written to `~/.devdoctor/history.json` after every repair
action (both successful and failed). Each entry is a JSON object on its own line (NDJSON
format) containing:

```json
{
  "timestamp": "2026-07-13T10:23:45.123Z",
  "plugin": "mysql",
  "checkName": "mysql-service",
  "action": "repair",
  "success": true,
  "message": "Successfully started MySQL service \"MySQL80\".",
  "dryRun": false
}
```

Fields:
- `timestamp` — ISO 8601 UTC timestamp of when the action was attempted
- `plugin` — plugin name (e.g. `"mysql"`)
- `checkName` — check name within the plugin (e.g. `"mysql-service"`)
- `action` — one of `"repair"`, `"verify"`, `"rollback"`
- `success` — whether the action succeeded
- `message` — the human-readable result message from the repair/verify/rollback result
- `dryRun` — whether this was a dry run (no actual changes)

The log file is created with `O_APPEND | O_CREAT` to avoid race conditions between
concurrent Dev Doctor processes. Each write is a single `fs.appendFileSync()` call of a
single newline-delimited JSON line, which is atomic at the OS level on all supported
platforms for lines under 4096 bytes.

A new `AuditLogger` class is added to `src/infra/audit/audit-logger.ts`. The `fix`
command (via `RepairEngine`) calls `auditLogger.log()` after each repair, verify, and
rollback action.

The log is never read by Dev Doctor itself in the current implementation. Future work
could add a `devdoctor history` command to display it.

---

## Consequences

- **Positive:** Developers have a reliable record of all repair actions for debugging and
  auditing purposes.
- **Positive:** NDJSON format is trivially parseable by standard tools (`jq`, `grep`,
  spreadsheet import).
- **Neutral:** The log grows indefinitely — no rotation is implemented in this iteration.
  The typical rate of repair actions is low enough that this is not a practical concern.
- **Negative:** Writes to `~/.devdoctor/history.json` fail silently (the error is logged
  to `stderr` but does not affect the repair outcome). This is intentional — audit logging
  must never block or fail a repair.
