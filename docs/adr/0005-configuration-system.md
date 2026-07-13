# ADR 0005: Configuration System

## Status

Accepted

## Date

2026-07-13

## Context

Dev Doctor needs a way to persist user preferences and project-level settings. Without configuration, every invocation requires explicit flags, and there is no way to disable a specific plugin for a project or change the default output format.

Two questions needed answering:

1. **Where should config files live?**
2. **How should multiple config files interact?**

## Options Considered

### Option A: Single config file in the project root only

Simple — one file, one location. No merging logic.

- **Pros**: Easy to understand, easy to implement.
- **Cons**: No user-level defaults. Every project that wants the same settings must duplicate them.

### Option B: Two-tier system — user-level + project-level

A common pattern used by Git, ESLint, npm, and most professional CLI tools.

- **Pros**: User sets personal defaults once (`~/.devdoctor/config.json`). Projects can override only what they need. Follows the Principle of Least Surprise for experienced developers.
- **Cons**: Requires merge logic. Slightly more complex to explain.

### Option C: Environment variables only

No files — settings via `DEVDOCTOR_FORMAT=json` style variables.

- **Pros**: Composable, no file I/O.
- **Cons**: Hard to persist. Verbose. Not self-documenting.

## Decision

**Use a two-tier JSON config system (Option B).**

Resolution order (lowest to highest priority):

```
~/.devdoctor/config.json   (user defaults)
       ↓
devdoctor.json             (project overrides)
       ↓
CLI flags                  (per-invocation overrides)
```

## Config Schema

```json
{
  "defaultFormat": "terminal | json | markdown",
  "reportOutputDir": "./reports",
  "plugins": {
    "mysql": { "disabled": true }
  }
}
```

## Rationale

1. **Follows established conventions.** Git, ESLint, Prettier, and most CLI tools use this exact pattern. Developers already know how it works.

2. **Project config enables team consistency.** A team can commit `devdoctor.json` to version control, ensuring everyone uses the same plugin set and output format in CI.

3. **User config enables personal defaults.** A developer who always wants JSON output can set `defaultFormat: "json"` once globally rather than typing `--format json` every invocation.

4. **Graceful degradation.** Missing or invalid config files produce warnings and fall back to defaults. The application never crashes due to a config error.

## Consequences

- Config is loaded once in the Composition Root and passed down to commands that need it.
- CLI flags always override config — they are the highest priority level.
- The `ConfigLoader` lives in the Infrastructure layer (filesystem access). The `DevDoctorConfig` and `ResolvedConfig` types live in the Core layer (no dependencies).

## Trade-offs

Merging two config files adds a small amount of complexity. The merge strategy — project fields override user fields, `plugins` map is merged key-by-key rather than replaced — is documented explicitly in the `ConfigLoader` source.
