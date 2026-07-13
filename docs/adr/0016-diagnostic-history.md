# ADR-0016 — Diagnostic History and Health Score Trending

**Status:** Accepted  
**Date:** 2026-07-13  
**Deciders:** Dev Doctor maintainers

---

## Context

`devdoctor doctor` runs a full health check but only shows the current state.
There was no way to answer: "When did my environment start degrading?" or
"Did the fix I applied last week hold up?"

The repair audit log (`~/.devdoctor/history.json`, ADR-0011) records individual
repair actions but not the overall health score across time.

---

## Decision

After every `devdoctor doctor` run, append a lightweight `HistoryEntry` snapshot
to `~/.devdoctor/runs.json` (NDJSON, one object per line).

A `HistoryEntry` records:
- ISO 8601 timestamp
- Overall health percentage and status
- Check counts (total / passed / warned / failed)
- Total run duration
- Plugin-level summary (`pluginName → overallStatus`) for per-plugin regression visibility

Add `devdoctor history` to read this file and render a terminal timeline showing:
- Date/time of each run
- Health score bar (reusing the existing `progressBar` formatter)
- Trend arrow (↑ / ↓ / →) between consecutive runs
- Per-plugin status badges on rows that had issues
- Options: `--last <n>` (default 10), `--format json`

The `FileHistoryStore` is injected into the `doctor` command at the Composition Root,
consistent with how `FileAuditLogger` is injected into `RepairEngine`.

### Storage format

```jsonl
{"timestamp":"2026-07-13T20:00:00.000Z","percentage":95,"status":"healthy","totalChecks":18,"passedChecks":17,"warningChecks":1,"failedChecks":0,"durationMs":1240,"pluginSummary":{"node":"pass","mysql":"warn","git":"pass"}}
{"timestamp":"2026-07-13T21:00:00.000Z","percentage":72,"status":"degraded","totalChecks":18,"passedChecks":13,"warningChecks":2,"failedChecks":3,"durationMs":1580,"pluginSummary":{"node":"pass","mysql":"fail","git":"pass"}}
```

---

## Consequences

**Positive:**
- Developers can correlate environment degradation with recent changes.
- The format is grep-friendly and trivially parseable by external tools.
- Write errors are swallowed — history failures never interrupt diagnostics.
- The file is capped at 100 entries on read to avoid unbounded growth affecting
  display performance (the file on disk is still append-only).

**Negative / Trade-offs:**
- History is per-machine and per-user — there is no shared/team history view.
- The snapshot is intentionally minimal (no full check details) to keep file size
  manageable. A `--verbose` history view with per-check detail is a future concern.
- `runs.json` coexists with `history.json` (repair audit) in `~/.devdoctor/`.
  The naming is intentionally distinct to avoid confusion between the two logs.

---

## Alternatives Considered

**A: Reuse `history.json` (repair audit log)**  
Rejected — the repair audit log records individual actions (repair/verify/rollback),
not diagnostic snapshots. Mixing these into one file would make both harder to read
and process independently.

**B: Store full DiagnosticResult per run**  
Rejected — storing the complete result set per run would cause unbounded file growth
and slow down the history command as the file grows. The lightweight snapshot is
sufficient for the trending use case.

**C: SQLite database**  
Rejected — adds a native dependency. NDJSON keeps the infrastructure layer
dependency-free and grep-friendly.
