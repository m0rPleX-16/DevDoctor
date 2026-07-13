# ADR 0014: Quiet Mode for CI Pipelines

## Status
Accepted

## Context
DevDoctor features rich terminal UI outputs including ANSI-colored text, dynamic ASCII art banners, and animated loading spinners via the `ora` package. While this creates an excellent developer experience in an interactive TTY, it introduces significant noise when executed in a headless CI/CD pipeline or when stdout is redirected to a file. CI systems often capture and print carriage returns (`\r`) and ANSI escape sequences verbatim, resulting in garbled, unreadable logs.

We needed a way to make DevDoctor fully machine-readable and CI-friendly without sacrificing the rich UX for local developers.

## Decision
We implemented a global `--quiet` (`-q`) flag that suppresses all non-essential UI decorations. 

When the flag is provided:
1. **Colors are disabled**: We set `chalk.level = 0` globally inside Commander's `preAction` hook, guaranteeing no ANSI color codes are emitted.
2. **Spinners are mocked**: We set `process.env.DEVDOCTOR_QUIET = '1'`, and `createSpinner()` returns a no-op mock object instead of starting an `ora` instance.
3. **Banners are skipped**: The `showBanner` and `showCompactBanner` UI components return early without printing.

## Consequences

### Positive
- **CI Ready**: DevDoctor can now be safely added to pre-commit hooks, GitHub Actions, and Jenkins pipelines using `devdoctor doctor --quiet` without polluting logs.
- **Global Reach**: By intercepting the flag at the Commander `preAction` hook and using `chalk.level` / environment variables, we avoided having to pass a `quiet` boolean down through every layer of the application.
- **Composable**: It works gracefully with `--format json` to ensure that only valid JSON is emitted to stdout, allowing easy piping into `jq` or other tools.

### Negative
- **Hidden State**: Relying on `process.env.DEVDOCTOR_QUIET` introduces a piece of global state. While generally discouraged in clean architecture, UI presentation logic at the outermost CLI boundary is an acceptable trade-off to prevent parameter drilling.
