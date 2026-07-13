# ADR 0001: Use TypeScript

## Status

Accepted

## Date

2026-07-13

## Context

Dev Doctor is a CLI application that needs to be maintainable, extensible, and serve as a learning platform for software architecture. The primary runtime is Node.js. The language choice affects developer experience, type safety, tooling support, and long-term maintainability.

## Options Considered

### 1. JavaScript (ES2022+)

- **Pros**: No build step, universal Node.js support, lower barrier to entry.
- **Cons**: No type safety, harder to refactor at scale, IDE support limited to inference, runtime type errors.

### 2. TypeScript

- **Pros**: Static type checking, excellent IDE support (autocompletion, refactoring), interfaces enforce contracts, self-documenting code, industry standard for large Node.js projects.
- **Cons**: Requires a build step, additional configuration (tsconfig), slightly more complex tooling.

### 3. Rust / Go

- **Pros**: Native binaries, excellent performance, strong type systems.
- **Cons**: Steeper learning curve, smaller ecosystem for CLI tooling compared to Node.js, diverges from the project's learning goals around Node.js and web development patterns.

## Decision

**Use TypeScript** as the primary language for Dev Doctor.

## Rationale

1. **Type safety enforces the Plugin interface contract.** The plugin architecture is central to Dev Doctor. TypeScript's interfaces guarantee that every plugin implements the required methods, catching errors at compile time rather than runtime.

2. **Self-documenting code.** Types serve as living documentation. A developer reading `diagnose(): Promise<DiagnosticResult>` immediately understands the function's contract without reading implementation details.

3. **Learning value.** TypeScript teaches concepts directly applicable to professional software development: generics, interfaces, type narrowing, and structural typing.

4. **Tooling excellence.** TypeScript provides first-class IDE support with autocompletion, inline errors, and automated refactoring — critical for a project that emphasizes clean architecture.

5. **Industry alignment.** TypeScript is the standard for large-scale Node.js applications, making the skills learned here directly transferable.

## Consequences

- A build step (`tsc`) is required before running the application.
- During development, `tsx` is used for rapid iteration without explicit compilation.
- All source files use `.ts` extension and ESM imports with `.js` extensions (Node16 module resolution).
- `tsconfig.json` enforces strict mode for maximum type safety.

## Trade-offs

The build step adds a small amount of friction, but `tsx` for development and `tsc` for production compilation mitigate this effectively. The learning curve of TypeScript is a net positive given the project's educational goals.
