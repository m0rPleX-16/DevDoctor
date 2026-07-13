# ADR 0002: Clean Architecture

## Status

Accepted

## Date

2026-07-13

## Context

Dev Doctor needs a software architecture that supports modularity, testability, and long-term extensibility. As a learning project, the architecture itself is a key deliverable — it should demonstrate professional engineering practices.

## Options Considered

### 1. Flat / Script-Based Structure

- **Pros**: Simple to start, minimal boilerplate.
- **Cons**: Quickly becomes unmanageable, no separation of concerns, difficult to test, tightly coupled.

### 2. MVC (Model-View-Controller)

- **Pros**: Well-known pattern, clear separation of data and presentation.
- **Cons**: Designed primarily for web applications with UI, doesn't map cleanly to CLI + plugin architectures, often leads to "fat controllers."

### 3. Clean Architecture

- **Pros**: Strict dependency rules, technology-agnostic core, highly testable, supports plugin architectures naturally, excellent learning vehicle.
- **Cons**: More boilerplate, can feel over-engineered for small projects.

## Decision

**Use Clean Architecture** with four distinct layers.

## Architecture Layers

```
┌─────────────────────────────────────┐
│  CLI Layer (Presentation)           │  ← Commander, Chalk, Ora
│  - Commands, UI rendering           │
├─────────────────────────────────────┤
│  Plugins Layer                      │  ← Technology-specific plugins
│  - Node.js, MySQL, Docker plugins   │
├─────────────────────────────────────┤
│  Core Layer (Domain + Application)  │  ← Interfaces, Engine, Types
│  - Plugin interface, Diagnostic     │
│    Engine, Domain types             │
├─────────────────────────────────────┤
│  Infrastructure Layer               │  ← OS APIs, File System
│  - Command runner, System info      │
└─────────────────────────────────────┘
```

### Dependency Rule

Dependencies point **inward**. Outer layers may depend on inner layers, but inner layers never depend on outer layers.

- **Core** depends on nothing.
- **Infrastructure** depends on Core types.
- **Plugins** depend on Core types and Infrastructure.
- **CLI** depends on Core, Plugins, and Infrastructure.

### Directory Mapping

```
src/
├── cli/          → CLI Layer
├── core/         → Core Layer (Domain + Application)
├── plugins/      → Plugins Layer
└── infra/        → Infrastructure Layer
```

## Rationale

1. **The Core layer has zero dependencies.** Domain types like `Plugin`, `DiagnosticResult`, and `CheckStatus` can be defined, tested, and reasoned about without importing any library. This makes the core of the application completely technology-agnostic.

2. **Testability.** Each layer can be tested in isolation. Core types need no mocks. The engine can be tested with mock plugins. Plugins can be tested with mock command runners.

3. **Extensibility.** Adding a new plugin never requires changes to the core. Adding a new output format (JSON, HTML) only changes the CLI layer.

4. **Learning value.** Clean Architecture is a cornerstone concept in professional software engineering. Implementing it from scratch teaches dependency management, separation of concerns, and the Dependency Inversion Principle.

## Consequences

- More files and directories than a flat structure.
- Import paths can be longer (mitigated by TypeScript path aliases).
- Developers must understand which layer a file belongs to when adding new code.
- The Composition Root (`src/cli/index.ts`) is the only place where concrete implementations are wired together.

## Trade-offs

The additional structure may feel heavy for a small project initially, but it pays dividends as the project grows. The plugin architecture in particular benefits enormously from the strict dependency rules — plugins can be developed and tested independently.
