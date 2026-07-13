# 🩺 Dev Doctor

> A cross-platform, plugin-based command-line utility that diagnoses, explains, and safely repairs common software development environment issues.

Dev Doctor isn't just another diagnostic tool — it **teaches you** about your development environment while helping you fix it. Every check includes an educational explanation of what's happening and why it matters.

---

## Features

- **Diagnose** — Run health checks on your development tools (Node.js, npm, and more to come)
- **Explain** — Understand *why* something is broken, not just *that* it's broken
- **Repair** — Safely fix common issues with confirmation and rollback *(coming soon)*
- **Report** — Get system information at a glance

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
```

---

## Commands

### `devdoctor diagnose <plugin>`

Run diagnostic checks for a specific technology.

```text
Options:
  -v, --verbose    Show detailed explanations for all checks, including passing ones
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

Display development-relevant environment variables grouped by category. Performs validation check on each PATH entry to identify missing or invalid directories.

```text
Options:
  --all    Show ALL environment variables, not just dev-relevant ones
  --path   Show only the PATH breakdown
```

### `devdoctor doctor`

Run a full health check across all registered plugins and scan for installed development tools to produce a unified health dashboard with an overall health score and actionable recommendations.

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
  Working Dir      C:\Code Practice\DevDoctor
  Home Dir         C:\Users\glenn
```

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
│   │   └── doctor.ts        #     devdoctor doctor
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
│   │   └── doctor-result.ts #     DoctorResult, HealthScore
│   └── engine/
│       └── diagnostic-engine.ts  # Orchestrates plugin diagnostics
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
└── infra/                   # Infrastructure Layer
    ├── os/
    │   └── command-runner.ts #   Safe child_process/shell wrapper
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

| ADR    | Decision                                         |
| :---  | :---                                             |
| [0001](docs/adr/0001-use-typescript.md) | Use TypeScript for type safety and learning value |
| [0002](docs/adr/0002-clean-architecture.md) | Use Clean Architecture with four layers           |
| [0003](docs/adr/0003-plugin-architecture.md) | Plugin system with Strategy + Registry patterns   |

---

## Roadmap

| Phase | Focus                           | Status      |
| :---  | :---                            | :---        |
| 1     | CLI Foundation                  | ✅ Complete  |
| 2     | System Information              | ✅ Complete  |
| 3     | Diagnostics Engine              | ✅ Complete  |
| 4     | Repair Engine                   | 🔜 Planned   |
| 5     | Plugin System (dynamic loading) | 🔜 Planned   |
| 6     | Reporting (JSON, Markdown, HTML)| 🔜 Planned   |
| 7     | Configuration (`devdoctor.json`)| 🔜 Planned   |
| 8     | Packaging (standalone binaries) | 🔜 Planned   |

---

## Guiding Principles

1. **Education First** — Explain what is happening and why, not just the result
2. **Safety Before Automation** — Never perform destructive actions without confirmation
3. **Transparency** — Show every command being executed
4. **Extensibility** — Every technology is a plugin; no tech-specific logic in the core
5. **Cross-Platform** — Architecture avoids platform-specific assumptions

---

## License

MIT
