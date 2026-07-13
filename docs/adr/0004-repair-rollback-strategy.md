# ADR 0004: Repair and Rollback Strategy

## Status

Accepted

## Date

2026-07-13

## Context

Phase 4 introduced automated repair capabilities. Repairs interact with the operating system — starting services, killing processes — and carry real risk. If a repair action succeeds mechanically but leaves the system in a worse state (e.g. a service starts but immediately crashes, blocking another process), the user needs a reliable way to return to the previous state.

Three design questions needed answers:

1. **How should the repair workflow be sequenced?**
2. **When should a rollback be attempted, and who triggers it?**
3. **How should repair capability be communicated to callers?**

---

## Options Considered

### Option A: Repair-only, no rollback

Plugins implement `repair()` and `verify()`. If verification fails, report the failure and stop. Leave the user to fix it manually.

- **Pros**: Simple, no additional interface complexity.
- **Cons**: Leaves the system in an unknown state. Violates the "Safety Before Automation" guiding principle. No recovery path for users.

### Option B: Automatic rollback always attempted

After every failed verification, always call `rollback()` regardless of whether the repair declared it supported.

- **Pros**: Maximum safety.
- **Cons**: Forces all plugins to implement rollback, even when rollback is impossible (e.g. a killed process cannot be restarted automatically). Leads to stub implementations that give false confidence.

### Option C: Opt-in rollback via `rollbackSupported` flag

The `RepairResult` returned by `repair()` includes a `rollbackSupported: boolean` field. The CLI calls `rollback()` only when the repair declared it possible and verification subsequently failed. The `rollback()` method is optional on the `Plugin` interface.

- **Pros**: Honest — only attempts rollback when the plugin knows it can succeed. Aligns with the "Never perform destructive operations without confirmation" principle. Keeps the interface clean for plugins where rollback is not applicable.
- **Cons**: Per-check granularity requires the plugin author to reason about reversibility for each repair action.

---

## Decision

**Use Option C — opt-in rollback via `rollbackSupported`.**

The full repair workflow is:

```
diagnose()
    ↓
Filter to 'fail' checks only (warn-level issues are informational)
    ↓
Ask user confirmation per issue
    ↓
repair(checkName)
    ↓ success = false → report failure, stop
    ↓ success = true
verify(checkName)
    ↓ success = true → report resolved, done
    ↓ success = false AND rollbackSupported = true AND plugin.rollback exists
rollback(checkName)
    ↓
Report rollback outcome
```

---

## Rationale

### Only 'fail' checks are offered for repair

Warnings (`warn` status) indicate informational issues — missing config files, log entries, non-elevated permissions — for which there is typically no safe automated fix. Offering to "repair" a warning like "config file not found" would either do nothing or risk destructive action. The fix command shows warnings with their suggestions but does not prompt for repair.

This is consistent with the "Education First" principle: the user is informed about the warning and given a suggestion to act on manually.

### `rollbackSupported` is set by the repair, not the interface

A single plugin may implement multiple repair actions with different reversibility. For example, the MySQL plugin can roll back a service start (stop the service) but cannot roll back a process kill (you cannot restart an arbitrary process). Encoding reversibility per `RepairResult` rather than per plugin gives the correct granularity.

### `rollback()` is optional on the `Plugin` interface

Making `rollback` optional (`rollback?(checkName: string): Promise<RepairResult>`) allows plugins to be developed incrementally. A plugin that only implements read-only verification does not need to define a rollback method. The CLI guards against calling it if it is undefined.

### Config is cached between `diagnose()` and `repair()`/`verify()`

The MySQL plugin parses `my.ini` during `diagnose()` and caches the result. Subsequent `repair()` and `verify()` calls reuse this cache rather than re-reading the file. This avoids redundant disk I/O and ensures that repair decisions are based on the same configuration snapshot the user saw in the diagnostic output. A fresh `diagnose()` always resets the cache.

---

## Consequences

- Every `repair()` call must return a `RepairResult` with an explicit `rollbackSupported` boolean. This is enforced by the TypeScript type system.
- Plugin authors must reason about reversibility when implementing `repair()`.
- The CLI never silently swallows a failed rollback — it reports the outcome clearly so the user knows manual intervention may be required.
- The `rollback()` method signature mirrors `repair()`: it takes a `checkName` and returns a `RepairResult`. This keeps the interface symmetric and allows rollback results to carry detail messages.

## Trade-offs

Opt-in rollback means some repair failures have no recovery path. This is the honest position: it is better to tell the user "this repair cannot be undone" than to silently leave rollback unimplemented and claim the system is restored. The `rollbackSupported: false` return value on `RepairResult` communicates this clearly to both the CLI and the user.
