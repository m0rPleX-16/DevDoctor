# ADR 0021 — Architectural Decoupling and Quality Automation

**Date:** 2026-07-15  
**Status:** Accepted

---

## Context

A comprehensive coding standards and architectural review of the codebase identified three areas for improvement:

1.  **Core Layer Architectural Leaks**:
    *   `RepairEngine` (Core layer) depended directly on the Infrastructure layer by importing `IAuditLogger` and the concrete `nullAuditLogger` fallback from `src/infra/audit/audit-logger.ts`.
    *   Both `DiagnosticEngine` and `RepairEngine` (Core layer) depended on the Plugins layer by importing `PluginRegistry` from `src/plugins/plugin-registry.ts`.
    *   These violated the strict **inward-only dependency rule** established in [ADR 0002](file:///c:/Code Practice/DevDoctor/docs/adr/0002-clean-architecture.md) (Core must depend on nothing).

2.  **Lack of Quality Automation**:
    *   No automatic linting or formatting tools (e.g., ESLint, Prettier) were configured. Without automated verification, style inconsistencies, dead code (unused imports/variables), and potential runtime bugs were creeping into the codebase.

3.  **Unused Configuration Overhead**:
    *   `tsconfig.json` defined TypeScript path aliases (`@core/*`, `@infra/*`, etc.), but the codebase used relative paths. Maintaining path aliases in ESM Node.js adds configuration complexity, requiring path-rewriting tools like `tsc-alias` during compilation.

---

## Decisions

### 1. Enforce Strict Core Independence

To restore perfect architectural boundaries, we did the following:
*   **Extract Audit Logger Abstractions**: Extracted `IAuditLogger` interface, `AuditEntry`/`AuditAction` types, and the `nullAuditLogger` fallback into a new Core domain file: [audit-logger.ts](file:///c:/Code Practice/DevDoctor/src/core/types/audit-logger.ts).
*   **Decouple Infrastructure Logger**: Changed [audit-logger.ts](file:///c:/Code Practice/DevDoctor/src/infra/audit/audit-logger.ts) to import its interface from Core types.
*   **Move Plugin Registry**: Moved `PluginRegistry` from `src/plugins/plugin-registry.ts` to the Core layer at [plugin-registry.ts](file:///c:/Code Practice/DevDoctor/src/core/plugin-registry.ts) since it is a generic container holding abstract `Plugin` contracts rather than tool-specific logic.
*   **Composition Root Wiring**: Dependency injection is fully managed in the CLI presentation layer ([index.ts](file:///c:/Code Practice/DevDoctor/src/cli/index.ts)), where concrete infrastructure objects (like `FileAuditLogger`) are instantiated and injected into Core engines.

### 2. Configure ESLint and Prettier flat configurations

To automate code quality enforcement:
*   Added Prettier configuration ([.prettierrc](file:///c:/Code Practice/DevDoctor/.prettierrc)) matching existing 2-space semicolon conventions.
*   Added modern ESLint flat configuration ([eslint.config.js](file:///c:/Code Practice/DevDoctor/eslint.config.js)) featuring support for TypeScript and Prettier rules.
*   Added `lint` and `format` npm scripts to `package.json`.
*   Cleaned up all pre-existing dead code, unused imports, useless regex escapes, and unpreserved error causes flagged by the newly introduced linter.

### 3. Clean up Unused Path Mappings

*   Removed the unused `"paths"` property from `tsconfig.json` to keep typescript configuration simple and avoid unnecessary rewrite tooling requirements.

---

## Consequences

*   **Positive:** Core layer contains zero dependencies on outer layers (Infrastructure, Plugins, CLI), achieving perfect compliance with Clean Architecture.
*   **Positive:** Style drift and lint issues are prevented automatically via standard npm scripts (`npm run lint` and `npm run format`).
*   **Positive:** Type safety is verified using ESLint's TypeScript configuration.
*   **Neutral:** Relative paths are retained. This maintains native compatibility with Node ESM requirements (requiring file extensions) without adding compiler wrappers.
