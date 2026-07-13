# ADR-0017 — Dependency-Aware Check Ordering

**Status:** Accepted  
**Date:** 2026-07-13  
**Deciders:** Dev Doctor maintainers

---

## Context

Some diagnostic checks are only meaningful if a prior check passed. Examples:

- Checking Redis port 6379 is pointless if `redis-server` is not installed.
- Checking Python pip or virtualenv is meaningless if Python itself is not found.
- Checking MySQL port occupancy when the service is not installed produces a
  confusing false negative ("nothing on port 3306" ≠ "MySQL is healthy").

Without dependency awareness, failed upstream checks cascade into noisy,
misleading downstream results that confuse the user.

---

## Decision

Add an optional `dependsOn?: string[]` field to `DiagnosticCheck` in the core
type (`src/core/types/diagnostic.ts`).

Add a `applyDependencySkips(checks: DiagnosticCheck[]): DiagnosticCheck[]` utility
function in `status-utils.ts`. This function:

1. Processes checks in array order (left to right).
2. For each check that declares `dependsOn`, looks up whether every named
   dependency has a `pass` status in the already-processed checks.
3. If any dependency did not pass, replaces the check with a `skip` result:
   `"Skipped — depends on '<name>' which did not pass."`.
4. Returns the resolved array — original passing checks are unchanged.

Plugins opt into dependency resolution by calling `applyDependencySkips()` on
their check array before returning the `DiagnosticResult`. This is an opt-in
per-plugin rather than a mandatory engine-level transform, which:

- Preserves backward compatibility — existing plugins (Node, MySQL, Git) are
  unchanged because they manage their own conditional logic already.
- Keeps the resolution logic testable in isolation.
- Allows plugins full control over their check ordering.

The Redis and Python plugins both use `applyDependencySkips()` to express clean
dependency trees.

### Example dependency tree (Redis)

```
redis-installation (no deps)
├── redis-service   (dependsOn: ['redis-installation'])
├── redis-port      (dependsOn: ['redis-installation'])
│   └── redis-ping  (dependsOn: ['redis-installation', 'redis-port'])
│       └── redis-memory (dependsOn: ['redis-ping'])
```

---

## Consequences

**Positive:**
- Eliminates confusing false-negative messages for downstream checks.
- Plugins express their check structure declaratively rather than via ad-hoc
  early-return logic.
- The `skip` message clearly states why the check was skipped, preserving the
  educational value of the tool.

**Negative / Trade-offs:**
- `dependsOn` is evaluated purely by name string matching. If a check's `name`
  field changes, dependencies silently break (they evaluate as "dependency not
  found → skip always"). This is acceptable given that check names are internal
  identifiers under the plugin author's control.
- Processing is strictly left-to-right. Circular dependencies are not detected —
  a circular dep would cause all checks in the cycle to skip permanently.
  This is considered acceptable since circular check dependencies are a plugin
  authoring error, not a runtime concern.

---

## Alternatives Considered

**A: Engine-level dependency resolution**  
Considered — the `DiagnosticEngine` could resolve dependencies globally across
all plugins. Rejected because cross-plugin dependencies don't make sense (the
MySQL port check should not depend on a Node.js check), and it would add
complexity to the engine for a problem that is purely intra-plugin.

**B: Conditional execution in plugin `diagnose()`**  
This was the prior approach (Git plugin checks only if installation passed).
Retained for plugins with complex branching logic. `applyDependencySkips` is the
preferred approach for new plugins where the dependency tree is a simple DAG.
