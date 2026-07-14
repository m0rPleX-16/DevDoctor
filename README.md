# 🩺 Dev Doctor

> A cross-platform, plugin-based command-line utility that diagnoses, explains, and safely repairs common software development environment issues.

Dev Doctor isn't just another diagnostic tool — it **teaches you** about your development environment while helping you fix it. Every check includes an educational explanation of what's happening and why it matters.

> Current version: **0.4.4**

---

## Features

- **Diagnose** — Run health checks on Node.js, MySQL, Git, Redis, and Python environments (or custom plugins)
- **Explain** — Detailed root causes and educational explanations for every check
- **Repair** — Safe, confirmation-prompted automatic repairs with rollback support and state transition diff
- **Rollback** — Explicitly undo a prior repair with `devdoctor rollback` (last session) or `devdoctor rollback <plugin> <check>` (single check)
- **History** — Timeline of past health check scores with trend arrows via `devdoctor history`
- **CI-Ready** — `--yes` to auto-confirm repairs and `--dry-run` to preview without changes
- **Audit Log** — Every repair action is recorded in `~/.devdoctor/history.json`
- **Run History** — Every `doctor` run is recorded in `~/.devdoctor/runs.json` for trending
- **Security Scan** — Detects dangerous PATH entries and suspected secrets in environment variables
- **Report** — Generate system health status in terminal, JSON, or Markdown formats
- **Configuration** — Custom configuration overlays using local `devdoctor.json` files
- **Extensible** — Dynamic runtime plugin loading directly from filesystem directories
- **Interactive** — Arrow-key menu when run with no arguments in a TTY, with secondary prompts for key flags (verbose, dry-run, format, etc.)
- **Shell Completions** — Tab completion scripts for bash, zsh, fish, and PowerShell
- **Dependency-Aware Checks** — Downstream checks skip cleanly when upstream checks fail, avoiding false negatives

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v18 or later

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd DevDoctor

# Install dependencies
npm install
```

### Usage

```bash
# Show help and available commands — or just run with no args for the interactive menu
npx tsx src/cli/index.ts

# Diagnose your Node.js environment
npx tsx src/cli/index.ts diagnose node

# Diagnose your Git environment
npx tsx src/cli/index.ts diagnose git

# Diagnose Redis (port, ping, memory)
npx tsx src/cli/index.ts diagnose redis

# Diagnose Python (version, pip, venv, PATH)
npx tsx src/cli/index.ts diagnose python

# Diagnose with detailed educational explanations
npx tsx src/cli/index.ts diagnose node --verbose

# Display system information (includes detected development tools)
npx tsx src/cli/index.ts info

# Display system information as JSON (CI-friendly)
npx tsx src/cli/index.ts info --format json

# Display development-relevant environment variables and PATH breakdown
npx tsx src/cli/index.ts env

# Run full health check across all plugins and tools
npx tsx src/cli/index.ts doctor

# View health score timeline across past runs
npx tsx src/cli/index.ts history

# Safely repair issues detected by a plugin
npx tsx src/cli/index.ts fix mysql

# Roll back the last repair on a specific check
npx tsx src/cli/index.ts rollback mysql mysql-service

# Roll back all repairs from the last session
npx tsx src/cli/index.ts rollback

# Manage configurations (show resolved settings, initialize local config, print paths)
npx tsx src/cli/index.ts config show
npx tsx src/cli/index.ts config path
npx tsx src/cli/index.ts config init

# Generate shell tab completions
npx tsx src/cli/index.ts completion bash >> ~/.bashrc
```

---

## Commands

### Interactive Menu (no arguments)

Running `devdoctor` with no arguments in a TTY launches an arrow-key navigation menu. After selecting a command, secondary prompts surface the most useful flags — no CLI syntax required:

```text
  Use ↑ ↓ arrows to navigate, Enter to select, Esc/q to exit.

  ❯  🩺  Full health check
          doctor — runs all plugins and shows a health dashboard

     🔍  Diagnose a plugin
     🔧  Fix issues
     ℹ️   System info
     📋  Environment variables

  Tip: Run devdoctor --help or devdoctor <command> --help for advanced flags.
```

| Command selected | Follow-up prompts |
|---|---|
| Diagnose | "Show verbose output?" → `--verbose` |
| Fix | "Dry run first?" → `--dry-run`; if no, "Auto-confirm?" → `--yes` |
| Doctor | "Output format?" → `--format terminal/json/markdown` |
| Info | "Output format?" → `--format terminal/json` |
| Env | "PATH only?" → `--path`; if no, "Show all?" → `--all` |
| History | "Show all recorded runs?" → `--last 100` |
| Rollback | Prompts for plugin → check name → "Auto-confirm?" → `--yes` |

In non-TTY environments (pipes, CI), running with no arguments falls back to the standard help output unchanged.

### `devdoctor diagnose <plugin>`

Run diagnostic checks for a specific technology.

```text
Options:
  -v, --verbose           Show detailed explanations for all checks, including passing ones
  -f, --format <format>   Output format: terminal (default), json, markdown
  --output <file>         Write report to a file instead of stdout
```

**Available plugins:**

| Plugin   | Description                                                                          |
| :---     | :---                                                                                 |
| `node`   | Node.js installation, npm availability, PATH configuration                           |
| `mysql`  | MySQL/MariaDB service, TCP port, config, error log checks                            |
| `git`    | Git installation, identity config, default branch, SSH key, line endings, credential helper |
| `redis`  | Redis installation, service, port 6379, PING connectivity, memory usage              |
| `python` | Python 3 installation, pip, virtual environment, PATH ordering conflict detection    |

### `devdoctor info`

Display system and environment information including OS, CPU, memory usage, runtime details, and detected development tools.

```text
Options:
  -f, --format <format>   Output format: terminal (default), json
```

### `devdoctor env`

Display development-relevant environment variables grouped by category. Performs validation check on each PATH entry to identify missing or invalid directories. Also flags security risks in the environment.

```text
Options:
  --all                   Show ALL environment variables, not just dev-relevant ones
  --path                  Show only the PATH breakdown
  -f, --format <format>   Output format: terminal (default), json
```

Security risks detected:
- `.` or empty entry in PATH (privilege escalation vector)
- World-writable PATH directories (Unix only)
- Environment variable names matching secret patterns (`*_TOKEN`, `*_KEY`, `*_SECRET`, etc.) with token-like values

### `devdoctor doctor`

Run a full health check across all registered plugins and scan for installed development tools to produce a unified health dashboard with an overall health score and actionable recommendations.

```text
Options:
  -f, --format <format>   Output format: terminal (default), json, markdown
  -o, --output <file>     Write report to a file instead of stdout
```

### `devdoctor completion <shell>`

Generate a shell tab-completion script. Supports `bash`, `zsh`, `fish`, and `pwsh`.

```bash
devdoctor completion bash  >> ~/.bashrc && source ~/.bashrc
devdoctor completion zsh   >> ~/.zshrc  && source ~/.zshrc
devdoctor completion fish  > ~/.config/fish/completions/devdoctor.fish
devdoctor completion pwsh  >> $PROFILE
```

### `devdoctor fix <plugin>`

Safely attempt automated repairs for issues detected by a specific plugin (e.g. starting stopped services, freeing port conflicts). Includes safety confirmations and post-repair verifications.

```text
Options:
  -y, --yes     Auto-confirm all repairs without prompting (for CI/scripted environments)
  --dry-run     Show what would be repaired without making any changes (exits 1 if issues exist)
```

When `--yes` is not provided and stdin is not a TTY (e.g. a CI pipeline), the command fails immediately with a clear message rather than hanging. Use `--yes` for non-interactive environments.

Every repair, verification, and rollback action is recorded in `~/.devdoctor/history.json` (NDJSON format) for auditing.

### `devdoctor rollback [plugin] [check]`

Undo automated repairs. Two modes:

- **No arguments** — rolls back all repairs from the last repair session (reads `~/.devdoctor/snapshots/latest.json`).
- **With arguments** — rolls back a single specific check for the named plugin.

Only available for checks whose plugin implements rollback support.

| Plugin | Check | What rollback does |
|---|---|---|
| `mysql` | `mysql-service` | Stops the service that was started |
| `mysql` | `xampp-process` | Kills the mysqld process that was spawned |
| `node` | `node-permissions` | Restores the previous npm global prefix from `~/.devdoctor/npm-rollback-prefix.txt` |
| `python` | `python-venv` | Deletes the `.venv` directory that was created |

```text
Options:
  -y, --yes     Auto-confirm rollback without prompting (for scripted environments)
```

```bash
devdoctor rollback                          # Undo all repairs from last session
devdoctor rollback --yes                    # Same, auto-confirmed
devdoctor rollback mysql mysql-service      # Undo a specific repair
devdoctor rollback node node-permissions
devdoctor rollback python python-venv --yes
```

After rolling back, run `devdoctor diagnose <plugin>` to confirm the environment state.

### `devdoctor history`

Show a timeline of past `devdoctor doctor` runs with health scores, trend arrows, and plugin-level status.

```text
Options:
  -n, --last <n>          Number of recent entries to show (default: 10)
  -f, --format <format>   Output format: terminal (default), json
```

```bash
devdoctor history          # Last 10 runs
devdoctor history --last 30
devdoctor history --format json | jq '.[] | .percentage'
```

Health score history is stored in `~/.devdoctor/runs.json` and updated automatically after every `devdoctor doctor` run.

### `devdoctor config`

Manage DevDoctor configurations (scaffold local configurations, view resolved settings, or locate files).

```text
Commands:
  init [options]           Scaffold a devdoctor.json in the current directory.
  show                     Display the resolved configuration currently in use.
  path                     Print the paths of all config files DevDoctor reads.

Options: (for init command)
  --force                  Overwrite an existing devdoctor.json file.
```

```bash
# Show active resolved configurations (merged user-level and project-level configs)
devdoctor config show

# Check which configuration files exist and where they are located
devdoctor config path

# Scaffold a default project-level devdoctor.json config in the current directory
devdoctor config init
```

---

## Example Output

### `diagnose node`

```text
Node.js Diagnostics

  Status: All checks passed
  Checks: 3
  Duration: 253ms

  ─────────────────────────────────────────────

  ✓ Node.js Version
    Node.js v20.11.0 is installed. (LTS)

  ✓ npm Version
    npm 10.2.4 is installed.

  ✓ Node.js PATH Configuration
    Node.js is on the PATH at: C:\Program Files\nodejs\node.exe

  ─────────────────────────────────────────────

  3 passed
```

### `info`

```text
Operating System

  Platform         Windows 11 (10.0.26200)
  Architecture     x64
  Uptime           5h 32m 10s

CPU

  Model            AMD Ryzen 7 3750H with Radeon Vega Mobile Gfx
  Cores            8 logical cores

Memory

  Total            15.44 GB
  Used             12.88 GB
  Free             2.56 GB
  Usage            83%
                   [█████████████████████████░░░░░]

Runtime

  Node.js          v20.11.0
  npm              v10.2.4
  Working Dir      C:\Projects\DevDoctor
  Home Dir         C:\Users\(Username)
```

---

## Security

Dev Doctor applies defence-in-depth across all layers (ADR-0009):

- **Shell injection prevention** — Arguments passed through Windows shell mode are sanitized, stripping `cmd.exe` metacharacters before building the command string.
- **Path traversal protection** — `--output` and `reportOutputDir` paths are resolved and validated to stay within the allowed output directory before any file is written.
- **Process name allowlist** — Windows `tasklist /fi` filters only accept names matching `*.exe` to prevent filter injection.
- **PID race mitigation** — Before killing a port-blocking process, the PID is cross-checked to confirm it still owns the port (prevents killing a recycled PID).
- **Elevation-aware Unix repair** — `sudo -n` is used instead of `sudo` to fail fast rather than hang when a TTY password prompt would be required.
- **mysqld startup probe** — TCP port polling replaces the previous fixed sleep for more reliable startup detection.
- **Concurrent fix guard** — A lockfile at `~/.devdoctor/fix.lock` prevents two `fix` runs from interfering with each other.

---

## Project Structure

Dev Doctor follows **Clean Architecture** with four distinct layers:

```text
src/
├── cli/                     # Presentation Layer
│   ├── index.ts             #   Composition root / entry point
│   ├── commands/            #   CLI command definitions
│   │   ├── diagnose.ts      #     devdoctor diagnose <plugin>
│   │   ├── info.ts          #     devdoctor info
│   │   ├── env.ts           #     devdoctor env
│   │   ├── doctor.ts        #     devdoctor doctor
│   │   ├── fix.ts           #     devdoctor fix <plugin>
│   │   ├── rollback.ts      #     devdoctor rollback <plugin> <check>
│   │   ├── history.ts       #     devdoctor history
│   │   ├── completion.ts    #     devdoctor completion <shell>
│   │   └── config.ts        #     devdoctor config [subcommand]
│   └── ui/                  #   Terminal UI helpers
│       ├── banner.ts        #     Welcome banner (gradient ASCII art)
│       ├── formatter.ts     #     UI formatting (progress bars, boxes, theme)
│       ├── interactive.ts   #     Arrow-key interactive menu (no-args TTY mode)
│       ├── logger.ts        #     Styled logging (chalk)
│       └── spinner.ts       #     Progress spinner (ora)
│
├── core/                    # Domain Layer (zero dependencies)
│   ├── types/               #   Shared domain types
│   │   ├── diagnostic.ts    #     DiagnosticResult, CheckStatus, dependsOn
│   │   ├── plugin.ts        #     Plugin interface contract
│   │   ├── system-info.ts   #     SystemInfo types
│   │   ├── environment.ts   #     EnvironmentInfo, PathEntry
│   │   ├── doctor-result.ts #     DoctorResult, HealthScore
│   │   ├── repair.ts        #     RepairResult, VerificationResult
│   │   └── history.ts       #     HistoryEntry (doctor run snapshots)
│   └── engine/
│       ├── diagnostic-engine.ts  # Orchestrates plugin diagnostics (concurrent, per-plugin timeout)
│       ├── repair-engine.ts      # Orchestrates repairs, verifications, rollbacks + audit logging
│       ├── check-runner.ts       # Dependency-aware task runner (runDiagnosticTasks)
│       ├── snapshot-manager.ts   # Persists repair session snapshots for session rollback
│       └── status-utils.ts       # deriveOverallStatus + applyDependencySkips
│
├── plugins/                 # Plugin Layer
│   ├── plugin-registry.ts   #   Plugin registration and lookup
│   ├── node/                #   Node.js plugin
│   ├── mysql/               #   MySQL plugin (with repair + rollback)
│   ├── git/                 #   Git plugin
│   ├── redis/               #   Redis plugin
│   │   ├── index.ts
│   │   └── checks/          #     installation, service, port, ping, memory
│   └── python/              #   Python plugin
│       ├── index.ts
│       └── checks/          #     installation, pip, venv, path
│
├── infra/                   # Infrastructure Layer
    ├── os/
    │   ├── command-runner.ts         #   Safe child_process wrapper (shell injection hardening)
    │   ├── process-manager.ts        #   Daemon spawn, TCP probe, process detection
    │   └── ...
    ├── audit/
    │   ├── audit-logger.ts           #   Repair audit log (~/.devdoctor/history.json)
    │   └── history-store.ts          #   Doctor run history (~/.devdoctor/runs.json)
    └── system/
        ├── system-info-collector.ts  # OS/CPU/memory info
        ├── tool-detector.ts          # Scans for 9+ dev tools
        └── env-scanner.ts            # Parses path & groups variables
```

### Dependency Rule

Dependencies flow **inward** — outer layers depend on inner layers, never the reverse.

```text
CLI → Plugins → Core ← Infrastructure
```

The **Core** layer has zero external dependencies. It defines the interfaces and types that all other layers depend on.

---

## Development

### Scripts

```bash
npm run dev          # Run with tsx (no build step)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled output
npm test             # Run unit tests
npm run test:watch   # Run tests in watch mode
```

### Adding a New Plugin

1. Create a directory under `src/plugins/<name>/`
2. Implement the `Plugin` interface from `src/core/types/plugin.ts`
3. Add diagnostic checks in a `checks/` subdirectory
4. Register the plugin in `src/cli/index.ts` (the Composition Root)

```typescript
// src/plugins/your-plugin/index.ts
import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';

export class YourPlugin implements Plugin {
  readonly name = 'your-tool';
  readonly displayName = 'Your Tool';
  readonly description = 'Diagnoses your tool installation.';

  async diagnose(): Promise<DiagnosticResult> {
    // Run your checks here
  }
}
```

### Tech Stack

| Tool | Purpose |
|------|---------|
| [TypeScript](https://www.typescriptlang.org/) | Language — strict mode, ESM |
| [Commander](https://github.com/tj/commander.js/) | CLI framework — argument parsing, help generation |
| [Chalk](https://github.com/chalk/chalk) | Terminal styling — colors, bold, dim |
| [Ora](https://github.com/sindresorhus/ora) | Spinners — visual feedback during operations |
| [Vitest](https://vitest.dev/) | Testing — fast, TypeScript-native test runner |
| [tsx](https://github.com/privatenumber/tsx) | Development — run TypeScript directly without compiling |

---

## Configuration, Plugins & Packaging

Dev Doctor includes advanced configurations, dynamic plugin loading, multi-format reporting, and binary packaging:

### Dynamic Plugin System & DI

Rather than manually importing and registering plugins inside the CLI entry point, Dev Doctor dynamically scans the `./plugins/` directory at startup:

- **Dynamic Imports**: Uses Node's dynamic `import()` to find directories with `index.js` files, load classes conforming to `Plugin`, and auto-register them.
- **Dependency Injection**: A lightweight DI container maps infrastructure tools (e.g. `CommandRunner`, `ConfigParser`) directly into plugin constructors, decoupling them further.

### Reporting Engine

A unified reporting facade exports diagnostic outcomes to files:

- **Interface**: `Reporter` contract defining `generate(results: DiagnosticResult[]): string`.
- **Implementations**:
  - `JsonRenderer`: Exports structured machine-readable logs.
  - `MarkdownRenderer`: Creates clean wiki-friendly tables and code summaries.

### Configuration (`devdoctor.json`)

Allows custom overrides of default service boundaries.

- **Schema**:

  ```json
  {
    "defaultFormat": "terminal | json | markdown",
    "reportOutputDir": "./reports",
    "plugins": {
      "mysql": { "disabled": false },
      "node": { "disabled": false }
    }
  }
  ```

- Dev Doctor will parse this file at startup to override standard check properties (like the default MySQL port).

### Compilation

Compiles standard Node.js/TypeScript source into stand-alone system binaries (`.exe` on Windows, native binaries on macOS/Linux) using `@yao-pkg/pkg`:

- Emits portable zero-dependency executables that require no Node.js installation on target client systems.
- Build commands:

  ```bash
  npm run build:binary:win     # Windows binary
  npm run build:binary         # Windows, Linux, and macOS binaries
  ```

---

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Update snapshots after an intentional renderer change
npx vitest --run -u src/cli/reporting/renderers.snapshot.test.ts
npx vitest --run -u src/core/engine/status-utils.snapshot.test.ts
```

The test suite has three layers:

- **Unit tests** — co-located with the code they test (e.g. `diagnostic-engine.test.ts` alongside `diagnostic-engine.ts`). Use mocks and fixtures.
- **Plugin contract tests** (`src/plugins/plugin-contract.test.ts`) — a generic harness that validates every built-in plugin satisfies the `Plugin` interface. Runs against the real plugin implementations.
- **Snapshot tests** — lock in the exact serialised output of the JSON and Markdown renderers, and the exact transformed arrays from `applyDependencySkips()`. Any accidental formatting regression shows immediately as a diff.

When you intentionally change renderer output or dependency-skip logic, update the affected snapshots with the `-u` flag shown above, review the diff, and commit the updated `.snap` files alongside your change.

---

## Architecture Decision Records

Key design decisions are documented as ADRs in [`docs/adr/`](docs/adr/):

| ADR    | Decision                                                    |
| :---  | :---                                                        |
| [0001](docs/adr/0001-use-typescript.md)          | Use TypeScript for type safety and learning value           |
| [0002](docs/adr/0002-clean-architecture.md)      | Use Clean Architecture with four layers                     |
| [0003](docs/adr/0003-plugin-architecture.md)     | Plugin system with Strategy + Registry patterns             |
| [0004](docs/adr/0004-repair-rollback-strategy.md) | Standardized interactive repair and rollback workflows      |
| [0005](docs/adr/0005-configuration-system.md)    | Two-tiered configuration resolution system                 |
| [0006](docs/adr/0006-dynamic-plugin-loading.md)  | Dynamic runtime filesystem plugin loading                   |
| [0007](docs/adr/0007-reporting-strategy.md)      | Pluggable multi-format reporting renderer pattern          |
| [0008](docs/adr/0008-packaging.md)               | Portable binary compilation packaging                       |
| [0009](docs/adr/0009-security-hardening.md)      | Shell injection, path traversal, PID race, sudo hardening   |
| [0010](docs/adr/0010-repair-engine-and-fix-ux.md) | RepairEngine, concurrent diagnostics, `--yes`/`--dry-run`  |
| [0011](docs/adr/0011-audit-log.md)               | Append-only NDJSON repair audit log                         |
| [0012](docs/adr/0012-env-security-checks.md)     | Environment security risk detection (PATH, secrets)         |
| [0013](docs/adr/0013-plugin-contract-testing.md) | Generic plugin contract test harness                        |
| [0014](docs/adr/0014-quiet-mode-for-ci.md)       | Quiet mode for CI pipelines                                 |
| [0015](docs/adr/0015-rollback-command.md)         | Explicit `devdoctor rollback` command                       |
| [0016](docs/adr/0016-diagnostic-history.md)       | Diagnostic history and health score trending                |
| [0017](docs/adr/0017-dependency-aware-checks.md)  | Dependency-aware check ordering with `dependsOn`            |
| [0018](docs/adr/0018-redis-python-plugins.md)     | Redis and Python plugin decisions                           |
| [0019](docs/adr/0019-check-runner-and-session-rollback.md) | Dependency-aware check runner, session rollback, auto-elevation |

---

## Roadmap

| Phase | Focus                                    | Status      |
| :---  | :---                                     | :---        |
| 1     | CLI Foundation                           | ✅ Complete  |
| 2     | System Information                       | ✅ Complete  |
| 3     | Diagnostics Engine                       | ✅ Complete  |
| 4     | Repair Engine                            | ✅ Complete  |
| 5     | Plugin System (dynamic loading)          | ✅ Complete  |
| 6     | Reporting (JSON, Markdown)               | ✅ Complete  |
| 7     | Configuration (`devdoctor.json`)         | ✅ Complete  |
| 8     | Packaging (standalone binaries)          | ✅ Complete  |
| 9     | Security Hardening                       | ✅ Complete  |
| 10    | RepairEngine + CI Fix UX                 | ✅ Complete  |
| 11    | Repair Audit Log                         | ✅ Complete  |
| 12    | Environment Security Checks              | ✅ Complete  |
| 13    | Git Plugin                               | ✅ Complete  |
| 14    | UX Improvements                          | ✅ Complete  |
| 15    | Interactive Menu + Flag Prompts          | ✅ Complete  |
| 16    | Redis + Python Plugins                   | ✅ Complete  |
| 17    | Dependency-Aware Check Ordering          | ✅ Complete  |
| 18    | Diagnostic History + Trending            | ✅ Complete  |
| 19    | Explicit Rollback Command                | ✅ Complete  |
| 20    | Snapshot Tests for Renderer Output       | ✅ Complete  |
| 21    | Node + Python Repair & Rollback          | ✅ Complete  |
| 22    | Check Runner + Session Rollback          | ✅ Complete  |

---

## Guiding Principles

1. **Education First** — Explain what is happening and why, not just the result
2. **Safety Before Automation** — Never perform destructive actions without confirmation
3. **Transparency** — Show every command being executed
4. **Extensibility** — Every technology is a plugin; no tech-specific logic in the core
5. **Cross-Platform** — Architecture avoids platform-specific assumptions

---

## CI/CD Workflow

The repository includes two GitHub Actions workflows:

**CI** (`.github/workflows/ci.yml`) — validates every push and pull request:

- **Trigger**: Runs on every `push` and `pull_request` targeting `main` or `dev`.
- **Matrix Testing**: Builds and tests on Node versions `18.x`, `20.x`, and `22.x`.
- **Steps**: install → build → test.

**Release** (`.github/workflows/release.yml`) — publishes on version tags from `main`:

- **Trigger**: `v*` tags pushed on `main` only. Tags on other branches do not trigger a release.
- **Steps**: build binaries (Windows, Linux, macOS) → create GitHub Release → publish to GitHub Packages.

---

## Non-Developer Guide

For  QA engineers, designers, or operations teams who need to verify local configurations, Dev Doctor can be run without setting up a local development environment.

### Option A: Using Node.js (Easiest)

If you have Node.js installed on your machine, first tell npm to resolve the `@m0rplex-16` scope using the GitHub Packages registry:

```bash
npm config set @m0rplex-16:registry https://npm.pkg.github.com
```

Now, you can run Dev Doctor instantly using `npx` (no installation required):

```bash
# Run the environment health check
npx @m0rplex-16/devdoctor doctor

# Run diagnostics for MySQL
npx @m0rplex-16/devdoctor diagnose mysql

# Automatically fix database issues
npx @m0rplex-16/devdoctor fix mysql
```

### Option B: Standalone Binaries (No Node.js Required)

If you do not have Node.js installed, you can use the pre-compiled standalone binary for your Operating System:

1. **Navigate to Releases**: Go to the **Releases** section on the right sidebar of the project's GitHub repository page.
2. **Download the Asset**: Locate the latest release (e.g., `v0.1.0`), expand the **Assets** section, and click to download the binary for your system:
   - **Windows**: `devdoctor-win.exe`
   - **macOS**: `devdoctor-macos`
   - **Linux**: `devdoctor-linux`
3. **Save and Locate**: Save the file to an accessible folder (e.g. `C:\tools\` or your User folder).
4. **Grant Execution Permissions (macOS/Linux only)**: Open your Terminal in the folder where the file was saved, and run the following command to allow the system to run it:

   ```bash
   chmod +x devdoctor-macos     # On macOS
   chmod +x devdoctor-linux     # On Linux
   ```

5. **Run Commands Directly**: Open your terminal (Command Prompt/PowerShell on Windows, Terminal on macOS/Linux) in the folder where the binary is saved and run:

   ```bash
   # Windows Command Prompt / PowerShell
   devdoctor-win.exe doctor
   devdoctor-win.exe fix mysql

   # macOS / Linux Terminal
   ./devdoctor-macos doctor
   ./devdoctor-macos fix mysql
   ```

---

## License

MIT

> See [CHANGELOG.md](CHANGELOG.md) for a full history of changes.
