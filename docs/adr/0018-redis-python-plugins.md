# ADR-0018 — Redis and Python Plugins

**Status:** Accepted  
**Date:** 2026-07-13  
**Deciders:** Dev Doctor maintainers

---

## Context

The plugin roadmap (suggestions #12 and #13) identified Redis and Python as
high-value, medium-effort additions. Both are ubiquitous in modern development
environments and are frequent sources of "why isn't my app working?" questions.

---

## Decision

Add two new built-in plugins: `RedisPlugin` and `PythonPlugin`.

### Redis Plugin (`src/plugins/redis/`)

| Check | Name | Depends On |
|---|---|---|
| Binary installed and on PATH | `redis-installation` | — |
| System service running | `redis-service` | `redis-installation` |
| Port 6379 bound by Redis | `redis-port` | `redis-installation` |
| PING/PONG connectivity | `redis-ping` | `redis-installation`, `redis-port` |
| Memory usage vs maxmemory | `redis-memory` | `redis-ping` |

All dependency resolution uses `applyDependencySkips()` (ADR-0017).

**Repair:** Redis repair is intentionally not automated. Starting a Redis service
requires elevation on most platforms and differs across Windows (sc start),
Linux (systemctl), and WSL. The checks provide precise, platform-specific
`suggestion` text instead. This is consistent with the Node.js and Git plugins.

### Python Plugin (`src/plugins/python/`)

| Check | Name | Depends On |
|---|---|---|
| Python 3 installed (python3 or python) | `python-installation` | — |
| pip available | `python-pip` | `python-installation` |
| Virtual environment active | `python-venv` | `python-installation` |
| PATH ordering / multi-version conflict | `python-path` | `python-installation` |

The installation check tries `python3` first (preferred on Unix/macOS), then
`python` (Windows / legacy). It detects Python 2 and warns rather than failing,
since Python 2 may still be present on older systems.

The PATH check detects multiple Python installations and warns when the system
Python resolves before a user-managed version (pyenv, Conda, user-local install).

**Repair:** Python environment repairs — installation, PATH reordering, venv
creation — are not automated. They require knowledge of the user's preferred
version manager (pyenv, Conda, system package manager, Windows installer) and
carry significant risk of breaking existing projects. The `suggestion` field
provides multi-path guidance covering all common setups.

### No-repair rationale

Both plugins follow the principle established in ADR-0004:
> "Never perform destructive actions without confirmation."

For Redis and Python, even "safe" repairs (starting a service, creating a venv)
can have side effects in multi-project environments. The educational `suggestion`
text achieves the same goal — telling the user exactly what to run — without
DevDoctor executing it on their behalf.

---

## Consequences

**Positive:**
- Five plugins now cover the most common development stack: Node.js, MySQL, Git,
  Redis, Python.
- The dependency-aware check structure produces clean, non-noisy output even when
  Redis or Python is not installed (all downstream checks skip rather than fail).
- Both plugins are registered in `BUILTIN_PLUGINS` and covered by the plugin
  contract test harness (ADR-0013).

**Negative / Trade-offs:**
- The Python `diagnose()` run involves 4-6 subprocess calls. On slow machines or
  where PATH search is expensive (Windows `where` command), this can take several
  seconds. The contract test is given a 15-second timeout to accommodate this.
- Redis and Python have no repair/rollback — users of `devdoctor fix redis` or
  `devdoctor fix python` will see "no repairable issues" even on failed checks.
  This is the correct behaviour and is clearly documented in suggestions.md.
