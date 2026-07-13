# 🩺 Dev Doctor

> A cross-platform, plugin-based command-line utility that diagnoses, explains, and safely repairs common software development environment issues.

Dev Doctor isn't just another diagnostic tool — it **teaches you** about your development environment while helping you fix it. Every check includes an educational explanation of what's happening and why it matters.

> Current version: **0.2.0**

---

## Features

- **Diagnose** — Run health checks on Node.js and MySQL local environments (or custom plugins)
- **Explain** — Detailed root causes and educational explanations for every check
- **Repair** — Safe, confirmation-prompted automatic repairs with rollback support
- **CI-Ready** — `--yes` to auto-confirm repairs and `--dry-run` to preview without changes
- **Audit Log** — Every repair action is recorded in `~/.devdoctor/history.json`
- **Security Scan** — Detects dangerous PATH entries and suspected secrets in environment variables
- **Report** — Generate system health status in terminal, JSON, or Markdown formats
- **Configuration** — Custom configuration overlays using local `devdoctor.json` files
- **Extensible** — Dynamic runtime plugin loading directly from filesystem directories

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
# Show help and available commands
npx tsx src/cli/index.ts

# Diagnose your Node.js environment
npx tsx src/cli/index.ts diagnose node

# Diagnose with detailed educational explanations
npx tsx src/cli/index.ts diagnose node --verbose

# Display system information (includes detected development tools)
npx tsx src/cli/index.ts info

# Display development-relevant environment variables and PATH breakdown
npx tsx src/cli/index.ts env

# Run full health check across all plugins and tools
npx tsx src/cli/index.ts doctor

# Safely repair issues detected by a plugin
npx tsx src/cli/index.ts fix mysql
```

---

## Commands

### `devdoctor diagnose <plugin>`

Run diagnostic checks for a specific technology.

```text
Options:
  -v, --verbose           Show detailed explanations for all checks, including passing ones
  --format <json|md|html> Format of the diagnostic report (Phase 6)
  --output <file>         Output file path to save report to (Phase 6)
```

**Available plugins:**

| Plugin  | Description                                                 |
| :---    | :---                                                        |
| `node`  | Node.js installation, npm availability, PATH configuration  |
| `mysql` | MySQL/MariaDB service, TCP port, config, error log checks   |

More plugins (Docker, Git, PostgreSQL, etc.) are planned for future phases.

### `devdoctor info`

Display system and environment information including OS, CPU, memory usage, runtime details, and detected development tools.

### `devdoctor env`

Display development-relevant environment variables grouped by category. Performs validation check on each PATH entry to identify missing or invalid directories. Also flags security risks in the environment.

```text
Options:
  --all    Show ALL environment variables, not just dev-relevant ones
  --path   Show only the PATH breakdown
```

Security risks detected:
- `.` or empty entry in PATH (privilege escalation vector)
- World-writable PATH directories (Unix only)
- Environment variable names matching secret patterns (`*_TOKEN`, `*_KEY`, `*_SECRET`, etc.) with token-like values

### `devdoctor doctor`

Run a full health check across all registered plugins and scan for installed development tools to produce a unified health dashboard with an overall health score and actionable recommendations.

### `devdoctor fix <plugin>`

Safely attempt automated repairs for issues detected by a specific plugin (e.g. starting stopped services, freeing port conflicts). Includes safety confirmations and post-repair verifications.

```text
Options:
  -y, --yes     Auto-confirm all repairs without prompting (for CI/scripted environments)
  --dry-run     Show what would be repaired without making any changes (exits 1 if issues exist)
```

When `--yes` is not provided and stdin is not a TTY (e.g. a CI pipeline), the command fails immediately with a clear message rather than hanging. Use `--yes` for non-interactive environments.

Every repair, verification, and rollback action is recorded in `~/.devdoctor/history.json` (NDJSON format) for auditing.

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
│   │   └── fix.ts           #     devdoctor fix <plugin>
│   └── ui/                  #   Terminal UI helpers
│       ├── banner.ts        #     Welcome banner (gradient ASCII art)
│       ├── formatter.ts     #     UI formatting (progress bars, boxes, theme)
│       ├── logger.ts        #     Styled logging (chalk)
│       └── spinner.ts       #     Progress spinner (ora)
│
├── core/                    # Domain Layer (zero dependencies)
│   ├── types/               #   Shared domain types
│   │   ├── diagnostic.ts    #     DiagnosticResult, CheckStatus
│   │   ├── plugin.ts        #     Plugin interface contract
│   │   ├── system-info.ts   #     SystemInfo types
│   │   ├── environment.ts   #     EnvironmentInfo, PathEntry
│   │   ├── doctor-result.ts #     DoctorResult, HealthScore
│   │   └── repair.ts        #     RepairResult, VerificationResult
│   └── engine/
│       ├── diagnostic-engine.ts  # Orchestrates plugin diagnostics (concurrent, per-plugin timeout)
│       └── repair-engine.ts      # Orchestrates repairs, verifications, rollbacks + audit logging
│
├── plugins/                 # Plugin Layer
│   ├── plugin-registry.ts   #   Plugin registration and lookup
│   └── node/                #   Node.js plugin
│       ├── index.ts         #     Plugin entry point
│       └── checks/          #     Individual diagnostic checks
│           ├── version-check.ts
│           ├── npm-check.ts
│           └── path-check.ts
│
├── infra/                   # Infrastructure Layer
    ├── os/
    │   ├── command-runner.ts         #   Safe child_process wrapper (shell injection hardening)
    │   ├── process-manager.ts        #   Daemon spawn, TCP probe, process detection
    │   └── ...
    ├── audit/
    │   └── audit-logger.ts           #   Repair audit log (~/.devdoctor/history.json)
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
```

Tests are co-located with the code they test (e.g., `diagnostic-engine.test.ts` alongside `diagnostic-engine.ts`).

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

---

## Roadmap

| Phase | Focus                           | Status      |
| :---  | :---                            | :---        |
| 1     | CLI Foundation                  | ✅ Complete  |
| 2     | System Information              | ✅ Complete  |
| 3     | Diagnostics Engine              | ✅ Complete  |
| 4     | Repair Engine                   | ✅ Complete  |
| 5     | Plugin System (dynamic loading) | ✅ Complete  |
| 6     | Reporting (JSON, Markdown)      | ✅ Complete  |
| 7     | Configuration (`devdoctor.json`)| ✅ Complete  |
| 8     | Packaging (standalone binaries) | ✅ Complete  |
| 9     | Security Hardening              | ✅ Complete  |
| 10    | RepairEngine + CI Fix UX        | ✅ Complete  |
| 11    | Repair Audit Log                | ✅ Complete  |
| 12    | Environment Security Checks     | ✅ Complete  |

---

## Guiding Principles

1. **Education First** — Explain what is happening and why, not just the result
2. **Safety Before Automation** — Never perform destructive actions without confirmation
3. **Transparency** — Show every command being executed
4. **Extensibility** — Every technology is a plugin; no tech-specific logic in the core
5. **Cross-Platform** — Architecture avoids platform-specific assumptions

---

## CI/CD Workflow

The repository includes a GitHub Actions Continuous Integration workflow (`.github/workflows/ci.yml`) that validates changes automatically:

- **Trigger**: Runs on every `push` and `pull_request` targeting the main branches.
- **Matrix Testing**: Builds and tests on Node versions `18.x`, `20.x`, and `22.x`.
- **Steps**:
  1. Clones the code.
  2. Sets up Node.js with caching enabled.
  3. Installs dependencies using `npm ci`.
  4. Builds the project (`npm run build`) to ensure type-checking passes.
  5. Executes all Vitest test suites (`npm test`).

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
