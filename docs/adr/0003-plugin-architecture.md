# ADR 0003: Plugin Architecture

## Status

Accepted

## Date

2026-07-13

## Context

Dev Doctor must support multiple technologies (Node.js, MySQL, Docker, Git, etc.) without coupling the core application to any specific technology. New technologies should be addable without modifying existing code. The architecture should enforce a consistent contract across all technology integrations.

## Options Considered

### 1. Monolithic Switch/Case

- **Pros**: Simple, everything in one place.
- **Cons**: Violates Open/Closed Principle, every new technology requires modifying existing code, impossible to test in isolation, grows into an unmaintainable monolith.

### 2. Strategy Pattern with Manual Registration

- **Pros**: Each technology is a separate class implementing a common interface, registered at startup. Clean separation, testable, follows SOLID principles.
- **Cons**: Plugins must be imported and registered in the Composition Root manually.

### 3. Dynamic Plugin Loading

- **Pros**: Plugins can be discovered at runtime from the filesystem, supports third-party plugins.
- **Cons**: More complex, requires plugin validation, security considerations, harder to debug.

## Decision

**Use Strategy Pattern with Manual Registration** in Phase 1, evolving to **Dynamic Plugin Loading** in Phase 5.

## Plugin Contract

```typescript
interface Plugin {
  name: string;           // Unique CLI identifier (e.g., "node")
  displayName: string;    // Human-readable name (e.g., "Node.js")
  description: string;    // Short description

  diagnose(): Promise<DiagnosticResult>;
  // Future phases:
  // repair(): Promise<RepairResult>;
  // verify(): Promise<VerificationResult>;
}
```

## Plugin Registry

A central `PluginRegistry` class manages plugin instances:

```typescript
class PluginRegistry {
  register(plugin: Plugin): void;
  get(name: string): Plugin | undefined;
  has(name: string): boolean;
  list(): Plugin[];
}
```

## Plugin Structure

Each plugin lives in its own directory under `src/plugins/`:

```
src/plugins/
├── plugin-registry.ts
├── node/
│   ├── index.ts         # Plugin class implementing Plugin interface
│   └── checks/          # Individual diagnostic checks
│       ├── version-check.ts
│       ├── npm-check.ts
│       └── path-check.ts
├── mysql/               # Future
├── docker/              # Future
└── git/                 # Future
```

## Design Patterns Used

1. **Strategy Pattern** — Each plugin is a strategy for diagnosing a specific technology.
2. **Registry Pattern** — Central lookup for available plugins.
3. **Facade Pattern** — The `DiagnosticEngine` provides a simple interface over plugin execution.
4. **Dependency Inversion** — The core depends on the `Plugin` interface, not concrete plugins.

## Rationale

1. **Open/Closed Principle.** Adding a new technology means creating a new plugin directory and registering it. Zero changes to existing code.

2. **Single Responsibility.** Each plugin is responsible only for its own technology. The MySQL plugin knows nothing about Docker.

3. **Testability.** Plugins can be tested with mock command runners. The engine can be tested with mock plugins. Everything is independently testable.

4. **Gradual complexity.** Starting with manual registration is simple and correct. Dynamic loading can be added later without changing the plugin implementations.

## Consequences

- Each new technology requires creating a new plugin class and registering it.
- All plugins must conform to the Plugin interface — the compiler enforces this.
- The Composition Root (`src/cli/index.ts`) grows by one line per new plugin registration.

## Evolution Path

| Phase | Registration Method |
|-------|-------------------|
| Phase 1-4 | Manual registration in Composition Root |
| Phase 5 | Dynamic discovery from `src/plugins/` directory |
| Future | External plugin packages (npm) |

## Trade-offs

Manual registration requires a small amount of boilerplate per plugin, but provides compile-time safety and simplicity. The evolution to dynamic loading is designed to be non-breaking — plugins won't need to change when the loading mechanism does.
