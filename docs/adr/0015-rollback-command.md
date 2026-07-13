# ADR-0015 — Explicit Rollback Command

**Status:** Accepted  
**Date:** 2026-07-13  
**Deciders:** Dev Doctor maintainers

---

## Context

ADR-0010 introduced the `RepairEngine` with rollback support. When a repair succeeds
mechanically but post-repair verification fails, the engine automatically calls
`plugin.rollback()`. However, there was no way for a developer to manually trigger
a rollback after the fact — for example:

- A fix ran with `--yes` in a CI pipeline and the result was unsatisfactory.
- The automated rollback was skipped because the issue was only noticed later.
- A developer wants to undo a repair they applied interactively.

Without a dedicated command, the only recourse was to manually reverse changes
(stopping a service, re-opening a port) — which defeats the purpose of an automated
repair tool.

---

## Decision

Add `devdoctor rollback <plugin> <check>` as a first-class CLI command.

The command:

1. Validates the plugin exists and implements `rollback()`.
2. Shows a clear description of what the rollback will do.
3. Requires interactive confirmation (or `--yes` for scripted use).
4. Guards against non-TTY environments without `--yes`, consistent with `fix`.
5. Routes through `RepairEngine.runRollback()` so the action is audit-logged.
6. Suggests `devdoctor diagnose <plugin>` afterward to confirm the environment state.

The interactive menu surfaces rollback via a "Roll back a repair" entry that
prompts for plugin → check name → auto-confirm preference, matching the UX
pattern of the `fix` and `diagnose` menu flows.

---

## Consequences

**Positive:**
- Developers have a safe, audited path to undo repairs without manual intervention.
- The rollback path is now user-discoverable rather than hidden inside the `fix` output.
- TTY / `--yes` guards are consistent with the `fix` command (ADR-0010).
- Audit log records the rollback action alongside the original repair (ADR-0011).

**Negative / Trade-offs:**
- Rollback is only meaningful for plugins that implement `rollback()`. Currently
  only `mysql` supports it (`mysql-service`, `xampp-process`). The command fails
  fast with a clear message for unsupported plugins rather than silently no-oping.
- There is no "rollback history" — the command operates on the current live state,
  not a stored snapshot. Full snapshot-based rollback is a future concern (see
  suggestions #6).

---

## Alternatives Considered

**A: Extend `fix` with a `--rollback` flag**  
Rejected — `fix` is already complex. A separate command makes rollback
independently discoverable via help and completions.

**B: Store repair snapshots and roll back to them**  
Deferred — snapshot-based rollback (suggestion #6) is a larger feature.
This ADR covers the immediate need: calling `plugin.rollback()` on demand.

**C: No explicit rollback command**  
Rejected — without it, developers who apply an automated fix and want to undo it
have no clean path. The repair audit log records the action but provides no
reversal mechanism.
