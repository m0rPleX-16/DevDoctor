# ADR 0007: Reporting Strategy

## Status

Accepted

## Date

2026-07-13

## Context

Dev Doctor's initial implementation rendered all output directly inside command handlers using chalk. This worked for terminal output but made it impossible to produce machine-readable or document-format reports without duplicating the entire rendering logic.

Phase 6 needed to add JSON and Markdown output without making the command handlers aware of format specifics.

## Options Considered

### Option A: Format flags with switch/case in each command

Add `if (format === 'json') { ... } else if (format === 'markdown') { ... }` inside each command's action handler.

- **Pros**: Simplest to implement.
- **Cons**: Violates Open/Closed Principle. Adding a new format means modifying every command. Command handlers grow into large, multi-concern functions.

### Option B: Separate render functions per format, called by commands

Extract rendering into standalone functions: `renderDiagnosticAsJson()`, `renderDiagnosticAsMarkdown()`, etc.

- **Pros**: Commands stay clean. Rendering logic is isolated.
- **Cons**: Still requires commands to know all available formats. No shared contract between renderers.

### Option C: Strategy Pattern — ReportRenderer interface

Define a `ReportRenderer` interface with `renderDiagnostic()` and `renderDoctor()`. Each format is a concrete implementation. Commands call `renderer.renderDiagnostic(result)` and handle the returned string.

- **Pros**: Open/Closed — new formats are new files, no changes to commands. Commands are format-agnostic. Consistent interface enforced by TypeScript. Clean Architecture — the interface lives in Core, implementations in CLI.
- **Cons**: Slightly more indirection.

## Decision

**Use the Strategy Pattern (Option C).**

```
src/core/reporting/
  report-renderer.ts        ← ReportRenderer interface (Core layer)

src/cli/reporting/
  json-renderer.ts          ← JsonRenderer implements ReportRenderer
  markdown-renderer.ts      ← MarkdownRenderer implements ReportRenderer
  renderer-factory.ts       ← createRenderer(format) factory function
```

## Rendering Contract

```typescript
interface ReportRenderer {
  renderDiagnostic(result: DiagnosticResult): string;
  renderDoctor(result: DoctorResult): string;
}
```

Renderers return a `string`. The caller (command handler or renderer factory) decides whether to write it to stdout or a file. This keeps I/O out of the renderers.

## Terminal vs Serialisable Formats

Terminal rendering is handled differently from JSON and Markdown:

- **Terminal**: Chalk-based, ANSI sequences, formatted by the existing command output logic. `createRenderer('terminal')` returns `null` — a signal to the command to use its existing chalk output path.
- **JSON / Markdown**: `createRenderer(format)` returns a renderer instance. The command calls `renderer.renderDiagnostic(result)` and writes the returned string.

This avoids a costly refactor of the existing terminal rendering while enabling new formats cleanly.

## --format and --output flags

Both `diagnose` and `doctor` commands accept:

- `--format terminal|json|markdown` — defaults to `config.defaultFormat` (Phase 7)
- `--output <file>` — writes the rendered content to a file; combined with `--format terminal`, writes a Markdown copy alongside the coloured terminal output

## Consequences

- Adding a new format (e.g., HTML) requires creating a new file implementing `ReportRenderer` and adding one case to `createRenderer()`. No other changes needed.
- The `DoctorResult` type was made available to the reporting layer so both commands can pass the same structured object to any renderer.
- JSON output is produced by `JSON.stringify(result, null, 2)`. Because `DiagnosticResult` and `DoctorResult` are plain objects with no methods, they serialise cleanly. `Date` fields become ISO strings.

## Trade-offs

Terminal rendering remains outside the Strategy Pattern. Migrating it would require wrapping all chalk calls into a `TerminalRenderer` class, which is worthwhile in a future phase when the terminal output grows more complex. For now, the null-renderer convention is a clean bridge between the old and new approaches.
