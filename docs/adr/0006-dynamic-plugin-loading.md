# ADR 0006: Dynamic Plugin Loading

## Status

Accepted

## Date

2026-07-13

## Context

Phase 1–4 used manual plugin registration in the Composition Root. This was the right choice for early development — simple, type-safe, and easy to reason about. ADR 0003 committed to evolving toward dynamic discovery in Phase 5.

The question is: what "dynamic" means in the context of a packaged CLI binary.

## Options Considered

### Option A: Pure filesystem discovery — no built-ins

Scan the plugins directory at startup, dynamically `import()` everything found, validate with a runtime type guard.

- **Pros**: Fully dynamic. Adding a plugin requires zero code changes.
- **Cons**: Breaks when the application is packaged as a standalone binary (Phase 8), because there is no `plugins/` directory on disk. Also, a corrupted or malicious plugin file can crash startup.

### Option B: Built-in manifest + optional filesystem discovery

Built-in plugins are always compiled into the binary. The filesystem scanner supplements them with external plugins found alongside the binary (in development or user-installed plugins).

- **Pros**: Works in both development and packaged binary modes. Built-ins are always available regardless of environment. External plugins are a bonus, not a requirement.
- **Cons**: Built-ins still need to be listed somewhere (the manifest). Adding a new built-in still touches the loader file.

### Option C: Plugin manifest file (JSON)

A `plugins.json` file lists the modules to load. The loader reads this file at startup.

- **Pros**: Declarative, no code changes to add a plugin.
- **Cons**: JSON can't reference TypeScript classes. Requires a separate build step to maintain. Adds a new file type that must stay in sync with the code.

## Decision

**Use Option B — built-in manifest + optional filesystem discovery.**

The `PluginLoader` in `src/infra/plugins/plugin-loader.ts`:

1. Always registers the compiled-in built-in plugins (`NodePlugin`, `MysqlPlugin`).
2. Scans the `plugins/` directory (relative to the loader) for subdirectories with an `index.js` or `index.ts` entry point.
3. Validates each loaded export with a runtime type guard (`isPlugin`).
4. Skips plugins that are disabled via config.
5. Warns — but does not crash — on load failures.

## Runtime Type Guard

Because `import()` returns `unknown`, we cannot rely on TypeScript to validate plugin shape at runtime. The `isPlugin()` guard checks:

```typescript
typeof obj.name === 'string'        // required
typeof obj.displayName === 'string' // required
typeof obj.diagnose === 'function'  // required
typeof obj.repair === 'function'    // required
typeof obj.verify === 'function'    // required
```

Optional methods (`rollback`, `canRepair`) are not validated — their absence is handled gracefully by callers.

## canRepair() capability method

Phase 5 added `canRepair?(checkName: string): boolean` to the Plugin interface. This lets the fix command ask a plugin whether it supports repair for a specific check before prompting the user, replacing the previous `status === 'fail'` heuristic. Plugins that don't implement it fall back to the `fail`-status heuristic.

## Consequences

- Adding a new built-in plugin requires updating the manifest array in `plugin-loader.ts` (one line).
- External/community plugins can be dropped into the `plugins/` directory without modifying any source file.
- The loader is the only place in the codebase that uses `import()` dynamically.
- Packaging (Phase 8) must include the built-in plugins in the binary bundle; external plugin discovery is a development-mode feature.

## Trade-offs

The hybrid approach is slightly more complex than pure manual registration, but significantly more flexible. The built-in manifest ensures a known-good baseline is always available, while dynamic discovery opens the door to the community plugin ecosystem described in ADR 0003's Evolution Path.
