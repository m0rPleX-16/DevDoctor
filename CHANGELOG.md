# Changelog

All notable changes to Dev Doctor are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] — 2026-07-18

### Added

- **9 New Framework and Language Plugins** — Implemented comprehensive diagnostic plugins for **Next.js**, **Django**, **Laravel**, **Express**, **FastAPI**, **Java**, **C++**, **C#**, and **PHP** (includes PHP installation, Composer availability, and `php.ini` configuration validation checks).
- **Smart Directory Detection** — Running `devdoctor` without arguments in an interactive terminal automatically scans the current directory and its ancestors (up to 5 levels) to detect relevant project plugins, printing the results directly below the welcome banner.
- **Language and Framework Separation** — Enforced category metadata (`language`, `framework`, `database`, `tool`) on the `Plugin` interface. Visualized this grouping across the CLI help manual (`devdoctor --help`), the full health check report (`devdoctor doctor`), and the interactive plugin picker sub-menus.
- **Comprehensive Unit Testing** — Added 29 isolated check-level test suites and 4 plugin-level repair/diagnose test suites, establishing robust patterns using Vitest mocks (`vi.spyOn`, `vi.stubEnv`) to verify diagnostic statuses under simulated filesystem and command outcomes.
- **Automated Repairs** — Added self-healing repair and verification capabilities for:
  - Next.js (`nextjs-env-local` to automatically create `.env.local` and configure `.gitignore`, and `nextjs-cache-staleness` to safely clear `.next/cache`).
  - C# (`csharp-nuget` to run `dotnet restore` to fix missing packages cache).
  - FastAPI (`fastapi-venv` to create a virtual environment via `python -m venv .venv` and ignore it in `.gitignore`).
- **Interactive UI/UX Refinement** — Grouped interactive menu choices into logical sections (Primary actions, Utilities, and Exit) separated by clean, visually pleasing dividers. Highlighted selected options with custom cursor indicators and formatted sub-selection text.
- **Polished Doctor & Diagnose CLI Formatting** — Redesigned terminal dashboards to feature a bold overall health score percentage, category icons, column-aligned check tallies, and clean, nested indentations for recommendations and diagnostics outputs.

### Changed

- **Refined Next.js Env Checks** — Updated `nextjs-env-local` to pass if any valid environment configuration file (`.env`, `.env.development`, `.env.production`, or `.env.local`) is present, reporting all detected files.
- **Resilient Express Project Detection** — Rebuilt Express project identification (`isExpressProject()`) to search dependencies in `package.json`, check for `node_modules/express` directly, and fall back to static analysis scanning common project entry points for `require('express')` or `import` statements.

## [0.4.9] — 2026-07-15

### Added

- **Quality Automation (ESLint & Prettier)** — Integrated ESLint flat configuration (`eslint.config.js`) and Prettier (`.prettierrc`) alongside associated `"lint"` and `"format"` npm scripts in `package.json` to enforce codebase quality and formatting standards automatically.
- **Core Audit Logger Abstractions (`src/core/types/audit-logger.ts`)** — Created domain types and interfaces (`IAuditLogger`, `AuditEntry`, `AuditAction`) and a default `nullAuditLogger` fallback directly within the Core layer, removing Core's direct dependency on the Infrastructure layer.
- **Enriched Project Detector (`src/infra/system/project-detector.ts`)** — Re-implemented the project detector with $O(1)$ in-memory Set lookup caching directory lists via `fs.readdirSync`, upward climbing traversal (up to 5 folders or until home directory is met) to detect workspace context from subdirectories, and support for file extension wildcard patterns (e.g. `*.py`).
- **Project Detector Tests (`src/infra/system/project-detector.test.ts`)** — Created comprehensive unit tests validating exact directory matches, parent directory traversal limits, and extension pattern lookups.

### Changed

- **Decoupled Architecture Boundaries** — Moved generic `PluginRegistry` from `src/plugins/plugin-registry.ts` to `src/core/plugin-registry.ts` and updated all relative import paths in 10 dependent files to fully isolate the Core layer.
- **Config Cleanup** — Removed unused TSConfig path alias properties (`@core/*`, etc.) to clean up compile-time dependencies.
- **README Documentation** — Documented the new quality automation scripts (`npm run lint` and `npm run format`) in the development commands list.

### Fixed

- **Pre-Existing Code Quality Issues** — Resolved 19 errors and 9 warnings reported by the linter, including cleaning up unused imports, correcting unpreserved error causes (by forwarding the caught error as a `{ cause }`), and fixing useless regex escapes.
- **Robust Python Installation Parsing** — Corrected Python `--version` parsing regex to support 2-digit Python versions (like Python 3.12) without misidentifying them as Python 2 EOL, and added a corresponding unit test suite `installation-check.test.ts`.
- **Cross-Platform MySQL Config Paths** — Added Unix MySQL configuration paths (`MYSQL_CONFIG_PATHS_UNIX`) and tilde expansion to allow proper config file checks on macOS and Linux systems.
- **Cross-Platform MySQL Log Hostname** — Used `os.hostname()` instead of Windows-only `process.env.COMPUTERNAME` to locate fallback database error logs on non-Windows platforms.
- **Dynamic Venv Suggestion Folder** — Updated manual activation suggestions to dynamically use the actual folder name of the detected virtual environment (`venv` or `.venv`) instead of hardcoding `.venv`.

---

## [0.4.8] — 2026-07-14

### Added

- **GitHub Repository Link in CLI Banner (`src/cli/ui/banner.ts`)** — Displays a clickable link to the official repository (`https://github.com/m0rPleX-16/DevDoctor`) inside the decorative CLI welcome banner box, making it easy for users to find the source code, open issues, and reference documentation.
- **Interactive "Shell completions" menu option (`src/cli/ui/interactive.ts`)** — Adds a "⇥ Shell completions" entry to the interactive TTY main menu with a choice prompt mapping to the supported shells (`bash`, `zsh`, `fish`, `pwsh`). Generates and prints the tab-completion script to stdout, making it easy for users to set up completion without memorizing CLI flags.
- **Global Quiet Mode Support in TTY Loop (`src/cli/index.ts`)** — Running `devdoctor --quiet` or `devdoctor -q` from an interactive TTY terminal now launches the menu loop in quiet mode (suppressing the header banner and color styles) rather than immediately exiting to command help.
- **`mysql-port` repair — auto-elevation fallback** — When `taskkill` (Windows) or `kill` (Unix) fails due to insufficient privileges, the repair now automatically retries with `runElevatedCommand` (UAC prompt on Windows, `sudo` on Unix) instead of returning a failure message. Error detection covers `"Access is denied"` / exit code 5 on Windows and `"Operation not permitted"` on Unix. The three other elevation-aware MySQL paths (`repair mysql-service`, `rollback mysql-service`, `rollback xampp-process`) already used this pattern — this closes the remaining gap.
- **`completion pwsh` — fix broken context-aware tab completion** — The PowerShell completion script rendered `'s+'` instead of `'\s+'` due to `\s` being silently consumed as a JavaScript escape sequence inside the template literal. The token-splitting regex never matched whitespace, so `$subCmd` was always empty and the switch always fell through to `default` — meaning Tab after `devdoctor diagnose` returned the full command list instead of plugin names. Fixed by double-escaping to `'\\s+'` in source.

### Changed

- **`README.md` documentation** — Added `Completion` command row to the interactive prompts table and bumped documented version to `0.4.8`.

---

## [0.4.7] — 2026-07-14

### Added

- **nvm detection in `node-permissions` repair** — Before changing the npm global prefix, the repair now checks for nvm (`NVM_DIR`, `~/.nvm`, nvm-windows paths). If nvm is detected, the repair returns a clear explanation of why it cannot proceed (changing the prefix breaks `nvm use`) and what to do instead. Previously it would silently corrupt the nvm setup.
- **Poetry and uv environment detection in `python-venv` check** — The check now recognises `POETRY_ACTIVE=1` (Poetry shell) and `UV_PROJECT_ENVIRONMENT` (uv) as active environments alongside `VIRTUAL_ENV` and Conda.
- **Local `.venv` / `venv` directory detection** — If a valid venv directory with activation scripts exists in the current directory but hasn't been activated in the current shell (common with VS Code, PyCharm, and uv), the check now returns `pass` with a note explaining how to activate it manually — instead of falsely warning.
- **Context-aware `python-venv` check** — The venv warning is now only issued when the current directory contains a Python project marker (`requirements.txt`, `pyproject.toml`, `setup.py`, `setup.cfg`, `Pipfile`, `.python-version`, `uv.lock`, `poetry.lock`). Running `devdoctor doctor` from a Node-only project or an unrelated directory no longer produces a spurious venv warning.
- **MySQL 9.x service name** — `MySQL90` added to `MYSQL_WINDOWS_SERVICES` ahead of `MySQL80`. Fresh MySQL 9 installs on Windows now register their service name correctly.

### Changed

- **`mysql-port` repair — graceful kill on Unix** — The port-conflict repair previously used `kill -9` (SIGKILL) immediately on Unix, which bypasses the process's shutdown handler and can leave InnoDB in a corrupted state. It now tries `kill -15` (SIGTERM) first, and only escalates to `kill -9` if SIGTERM fails.
- **`node-permissions` repair detail message** — On success, the detail now explicitly shows the exact `bin/` directory that needs to be added to `PATH`, with platform-specific instructions (System Properties on Windows, shell profile on Unix).
- **`history` command — `--last` validation** — Non-numeric values (e.g. `--last abc`) now produce a clear error message instead of silently defaulting to 10.
- **`history` command — `--format` validation** — Unknown format values now produce an error, consistent with `info` and `doctor`.
- **`history` command — `historyStore.read()` guarded** — A corrupted `runs.json` no longer crashes with an unhandled exception. The error is caught and a message is shown directing the user to `devdoctor clean history`.
- **`history` command — static import** — The dynamic `await import('../../infra/audit/history-store.js')` at the bottom of the action handler replaced with a static top-level import.
- **`config show` — `loadConfig()` guarded** — A `devdoctor.json` with invalid JSON no longer crashes `devdoctor config show` with an unhandled exception. The error is caught and a message is shown directing the user to `devdoctor config path`.
- **MySQL constants consistency** — `MYSQL_CONFIG_PATHS_WINDOWS` now lists MySQL 9.0 paths before 8.0 paths, consistent with the updated `MYSQL_WINDOWS_SERVICES` priority order.
- **`python-venv` suggestion enriched** — The warning now mentions `uv sync`, `poetry install`, and `pipenv install` as alternatives to `python3 -m venv`, reflecting modern Python tooling.

### Fixed

- **False positive `python-venv` warning in non-Python projects** — Previously the check warned about a missing venv regardless of whether the current directory had anything to do with Python. Now only Python projects trigger the warning.
- **False positive `python-venv` warning when venv exists but isn't shell-activated** — A `.venv` directory created by uv, Poetry, or a manual `python -m venv` that exists in the project but isn't activated in the current shell session now correctly reports `pass` instead of `warn`.
- **nvm users silently broken by `node-permissions` repair** — The repair now detects nvm and refuses rather than overwriting the npm prefix, which would cause `nvm use` to fail with an incompatibility error on subsequent runs.
- **`XAMPP_MYSQLD_FALLBACK_PATHS` duplicate entries removed** — The constants file previously had duplicate path entries. Now contains exactly one entry per installation path.
- **Node repair test fragile on nvm machines** — `node/index.test.ts` now explicitly removes `NVM_DIR`/`NVM_HOME` from the environment and mocks nvm path checks during the repair test, so the test passes on any machine regardless of whether nvm is installed.

---

## [0.4.6] — 2026-07-14

### Added

- **`projectMarkers` validation in plugin contract tests** — `plugin-contract.test.ts` now asserts that when a plugin declares `projectMarkers`, it is a non-empty array of non-empty strings. Covers all five built-in plugins.
- **Snapshot manager injected path** — `SnapshotManager` now accepts an optional `snapshotDir` constructor argument. When omitted, it defaults to `~/.devdoctor/snapshots` as before. This makes the class fully testable without touching the real user directory.
- **`SnapshotManager` test suite expanded** (`src/core/engine/snapshot-manager.test.ts`) — Tests now run against a temp directory (`os.tmpdir()`) instead of the live `~/.devdoctor` path. New cases added: `clearSnapshot` no-op on missing file, corrupted-JSON recovery on `getLatestSnapshot`, fresh-start after corruption on `recordRepair`, automatic intermediate directory creation, and sequential two-instance write behaviour. Suite grows from 3 to 9 tests.
- **`devdoctor info` — Project Context section** — When the `registry` is injected, `info` now shows a "Project Context" section listing which plugins were detected in the current directory (via `projectMarkers`) along with the matched files. Only shown when at least one plugin matches. Links to `devdoctor doctor` for next steps.
- **`devdoctor info` — `--format` validation** — Unknown `--format` values (e.g. `--format markdown`) now produce a clear error instead of silently falling through to JSON output.

### Changed

- **Completion scripts fully updated** — All three generators (bash/zsh, fish, PowerShell) now include: `history`, `rollback`, `config`, `clean` in the command list; `redis` and `python` in the plugin list; sub-command completions for `config init|show|path` and `clean snapshot|history|audit|lock|all`; and `--last` / `--yes` option completions for `history`, `rollback`, and `clean`.
- **Interactive menu — history picker** — "Show all recorded runs?" yes/no prompt replaced with a four-option numbered picker: last 10 (default) / 25 / 50 / 100. No more silent 100-entry cap disguised as "show all".
- **Interactive menu — clean Esc behaviour fixed** — Pressing Esc in the clean sub-menu previously dispatched `devdoctor clean all` (destructive default). It now returns `null` and restarts the main menu, consistent with every other sub-menu's Esc handler.
- **Interactive menu — `lineCount()` ghost line fixed** — The function now correctly counts `items.length + 6` total rendered lines, matching what `renderMenu` actually writes. Previously the count was off by one, causing a ghost line to accumulate with every up/down navigation keystroke.
- **`devdoctor info` — `createInfoCommand` accepts optional `registry`** — The composition root now passes the registry so the Project Context section can be rendered.

### Fixed

- **MySQL service-check grammar typo** — `"encountered an error query status"` corrected to `"encountered an error querying its status"` in the unknown-status branch of `service-check.ts`.
- **Redis `installation-check` thin pass-path detail** — The pass-path `detail` now explains Redis versioning milestones (6.0 TLS/ACL, 7.0 multi-part AOF) so the educational standard matches the other plugins.
- **README project structure tree missing `clean.ts`** — Added to the commands listing.
- **README roadmap missing Phase 23** — "Clean Command + State File Management" entry added.
- **README interactive menu table missing Config and History rows** — Both now appear with their correct prompts.

---

## [0.4.5] — 2026-07-14

### Added

- **`devdoctor clean` command (`src/cli/commands/clean.ts`)** — A new command to prune persistent state files from `~/.devdoctor/`. Supports five targeted subcommands:
  - `snapshot` — deletes `snapshots/latest.json` (clears rollback session history, with warning output).
  - `history` — deletes `runs.json` (resets doctor run timeline history).
  - `audit` — deletes `history.json` (clears the repair audit logs).
  - `lock` — deletes `fix.lock` (recovers from crashed fix runs).
  - `all` — wipes all of the above.
  Supports `-y` / `--yes` for auto-confirming in scripted/non-TTY environments. (ADR-0020)
- **Interactive "Clean state files" menu option (`src/cli/ui/interactive.ts`)** — Adds a "🧹 Clean state files" entry to the interactive TTY main menu with a secondary choice prompt mapping to the five subcommands.
- **ADR-0020** — Clean command design documented.

### Changed

- **`README.md` documentation** — Added documentation section for `devdoctor clean` command usage and table explaining subcommands.
- **Modernized CLI Terminal Icons** — Replaced all emojis in CLI outputs and interactive menus (including `doctor`, `info`, `env`, `fix`, `diagnose`, `rollback`, and `clean`) with clean, themed, geometric Unicode symbols (like `❖`, `⌕`, `⚒`, `ℹ`, `☰`, `⧉`, `↺`, `⚙`, `◇`, `×`) to improve terminal compatibility, rendering robustness, and design polish.

---

## [0.4.4] — 2026-07-14

### Added

- **`CheckRunner` (`src/core/engine/check-runner.ts`)** — New dependency-aware task runner that replaces the post-hoc `applyDependencySkips()` approach. `runDiagnosticTasks()` accepts a list of `DiagnosticTask` objects and executes them in dependency order: tasks whose upstream dependencies pass run concurrently; tasks with a failed dependency are marked `skip` immediately without invoking their `run()` function. Circular/unresolvable graphs are detected and remaining tasks are gracefully skipped. (ADR-0019)
- **`DiagnosticTask` interface** (`src/core/types/diagnostic.ts`) — New type that bundles a check's `name`, human-readable `label`, optional `dependsOn[]`, and `run()` function. Used by `runDiagnosticTasks()` and all built-in plugins.
- **`SnapshotManager` (`src/core/engine/snapshot-manager.ts`)** — Persists a record of all successful rollback-supported repairs to `~/.devdoctor/snapshots/latest.json`. Provides `recordRepair()`, `getLatestSnapshot()`, and `clearSnapshot()`. (ADR-0019)
- **`RepairEngine.rollbackAll()`** — Reads the latest snapshot and rolls back all recorded repairs in reverse order, then clears the snapshot. Used by `devdoctor rollback` with no arguments.
- **`devdoctor rollback` (no-arg mode)** — Running `devdoctor rollback` without arguments now rolls back the entire last repair session using the snapshot. The existing `devdoctor rollback <plugin> <check>` single-check path is unchanged.
- **`runElevatedCommand()` (`src/infra/os/command-runner.ts`)** — New function that runs a command with elevated privileges. On Windows, uses `PowerShell Start-Process -Verb RunAs` (triggers UAC). On Unix, prepends `sudo`.
- **Git `git-crlf` check** (`src/plugins/git/checks/crlf-check.ts`) — Warns when `core.autocrlf` is not configured or is inappropriate for the current platform (Windows: `true`; Unix: `input`/`false`). Teaches why CRLF vs LF matters across operating systems, with platform-specific suggestions on all paths.
- **Git `git-credential-helper` check** (`src/plugins/git/checks/credential-helper-check.ts`) — Warns when no global credential helper is configured. Recognises well-known helpers by name (GCM, osxkeychain, libsecret, wincred), warns specifically when the insecure plaintext `store` helper is in use, and explains what credential helpers do on all paths.
- **`Plugin.projectMarkers` field** (`src/core/types/plugin.ts`) — New optional field on the `Plugin` interface. Plugins declare an array of filenames/directories that signal they are relevant to the current working directory (e.g. `package.json` for Node, `.git` for Git, `requirements.txt` for Python).
- **`src/infra/system/project-detector.ts`** — New `detectProjectContext(plugins, cwd)` utility that scans `process.cwd()` for each plugin's declared markers and returns which plugins are relevant to the current project, along with which marker files triggered the match.
- **ADR-0019** — Check runner, session rollback, auto-elevation, and new git checks documented.

### Changed

- **All built-in plugins now use `runDiagnosticTasks()`** — Node, MySQL, Git, Redis, and Python plugins have all migrated to the new `check-runner`. Dependency resolution now happens *before* a check's `run()` is invoked, not as a post-hoc replacement. This is a correctness improvement: checks that depend on data produced by upstream checks (e.g. `mysql-port` needing the port number from `mysql-config`) can safely rely on that data being set.
- **`devdoctor doctor` — context-aware Plugin Diagnostics section** — When project markers are detected in the current directory, the Plugin Diagnostics section is split into two groups: **Detected in this project** (green `· detected` tag + matched filenames) and **Other plugins** (muted `· not in project` tag). Falls back to the previous flat list when no markers match, so behaviour is unchanged in bare directories.
- **MySQL `repair()` and `rollback()` — auto-elevation** — Service start/stop and process kill operations now automatically retry with `runElevatedCommand()` when they receive a `System error 5` / `Access is denied` response, instead of returning a "run as administrator" error message.
- **`RepairEngine`** — Injects `SnapshotManager` and records each successful repair (where `rollbackSupported: true`) to the snapshot after `plugin.repair()` returns.
- **`devdoctor rollback` help text and JSDoc** — Updated to reflect optional arguments and two usage modes.
- **`fix.ts` multi-line output** — `Proposal:`, `Detail:`, and `Action:` lines in the repair workflow now split on `\n` and prefix each continuation line with the tree connector, so multi-line suggestions and tips no longer print flush-left.
- **`diagnose.ts` multi-line suggestions** — `renderCheck` now splits `suggestion` on `\n` and aligns each continuation line under the `💡` prefix, consistent with the fix and doctor commands.
- **`diagnose.ts` dependency-skip indicator** — When a check is skipped because of a failed upstream dependency, a dim `↳ blocked by a failed upstream check` line is shown beneath the skip message, making the cascade legible at a glance.
- **`env.ts` multi-line suggestions** — Security risk `suggestion` fields in `renderSecurityRisks` now split on `\n` with proper connector-aligned continuation lines.
- **`fix.ts` no-repair suggestion alignment** — Multi-line suggestions in the "no automated repair available" block now indent correctly.
- **`doctor.ts` Recommendations plugin attribution** — Each recommendation item now shows a muted `[PluginName]` tag before the suggestion text, so it's clear which plugin each item belongs to when there are recommendations across multiple plugins.
- **`history.ts` timestamp timezone** — `formatTimestamp` now appends a `UTC±HH:MM` offset to each timestamp, making history entries unambiguous across machines and timezones.
- **`history.ts` empty-state copy** — The empty history message now explains what creates history entries, what they capture, and how to record the first one — instead of just "No history found."
- **`interactive.ts` rollback menu** — The "Roll back a repair" interactive flow now offers two modes upfront: **Last session** (maps to `devdoctor rollback` with no args) and **Specific check** (plugin + check picker). The menu item description is updated to reflect both modes.
- **Educational `detail` enriched on thin checks:**
  - Git `installation-check` — pass path now explains what Git is and why it's a prerequisite for the remaining checks.
  - Git `identity-check` — pass path now explains what the name/email is embedded into and why attribution matters.
  - Git `crlf-check` — full CRLF/LF education on all paths including a shared explanation block.
  - Git `credential-helper-check` — explains what credential helpers are, why they exist, and distinguishes between secure and insecure helpers.
  - Python `installation-check` — pass path now mentions relevant version milestones (3.8, 3.10, 3.11).
  - Python `pip-check` — pass paths now explain PyPI, `requirements.txt` reproducibility, and the significance of the module-invocation fallback.

### Fixed

- **Python plugin inconsistency** — Python was the only plugin still using the old `applyDependencySkips()` post-hoc pattern and running all checks eagerly before resolving skips. It now uses `runDiagnosticTasks()` in line with all other plugins.
- **MySQL dynamic `import()` in `diagnose()`** — `runDiagnosticTasks` was imported with a dynamic `await import()` inside the method body. It is now a static top-level import, consistent with all other plugins.
- **MySQL untyped task array** — The `tasks` array in `MysqlPlugin.diagnose()` was inferred as `{name: string; ...}[]` rather than `DiagnosticTask[]`, meaning TypeScript could not catch shape mismatches. Now explicitly typed.
- **Redis plugin inconsistency** — Redis was the last built-in plugin still using `applyDependencySkips()`. It now uses `runDiagnosticTasks()`, completing the migration across all five plugins.

---

## [0.4.3] — 2026-07-13

### Added

- **`devdoctor config` command** — Three sub-commands for managing DevDoctor configuration:
  - `devdoctor config init` — scaffolds a `devdoctor.json` in the current directory with sensible defaults. `--force` overwrites an existing file. Surfaces the path traversal guard already in `writeProjectConfig()`.
  - `devdoctor config show` — displays the fully resolved configuration (merged user + project config) in styled terminal output.
  - `devdoctor config path` — prints the paths of both config files with existence indicators, so users can see exactly what DevDoctor is reading.
- **`GitPlugin.canRepair()`** — Explicit `return false` stub added. Previously missing, which meant the `fix` command's `canRepair` fallback heuristic (`status === 'fail'`) would incorrectly offer repairs for Git checks.
- **`RedisPlugin.canRepair()`** — Same explicit `return false` stub added for the same reason.
- **Config sub-command in interactive menu** — "⚙️ Configuration" entry added to the arrow-key menu. Selecting it prompts: init / show / path, then dispatches the chosen sub-command.
- **Guided check picker in rollback flow** — `askRollbackOptions()` in `interactive.ts` now shows a numbered list of the known rollback-supported checks for the selected plugin (`mysql-service`, `xampp-process`, `node-permissions`, `python-venv`) instead of a free-form text input. Unknown plugins still fall back to free-form entry with a warning.
- **Looping interactive menu** — Running `devdoctor` without arguments in a TTY now runs the interactive menu in a loop. When a selected command finishes, it prompts the user to press any key to return to the main menu instead of exiting. The Commander program is rebuilt dynamically on each loop to prevent option state leakage, and Commander's exits are cleanly caught.
- **`waitReturnToMenu()` helper** — Helper function added in `interactive.ts` to configure raw stdin mode and wait for any keypress before resolving.

### Fixed

- **`lineCount()` rendering calculation** — The interactive menu's line count was slightly off, causing the `clearLines()` call to occasionally overwrite one line of prior content when navigating between items. The count now correctly accounts for: header + blank + items + description + blank + tip + blank.
- **`getProjectConfigPath()` dead code** — The function was exported with a "future" comment since 0.1.0 but never called from the CLI. It is now the backbone of `devdoctor config init` and `devdoctor config path`.

### Changed

- **`devdoctor rollback` help text** — Rollback examples in `--help` now include all four supported check names.
- **Project structure in README** — `config.ts` command added to the project structure tree.

---

## [0.4.2] — 2026-07-13

### Added

- **`NodePlugin` repair + rollback** — `node-permissions` check now supports automated repair. The repair changes the npm global prefix to a user-writable directory (`%APPDATA%\npm-global` on Windows, `~/.npm-global` on Unix), saves the previous prefix to `~/.devdoctor/npm-rollback-prefix.txt` for rollback, and creates the target directory if needed. `rollback()` restores the original prefix and cleans up the rollback file.
- **`PythonPlugin` repair + rollback** — `python-venv` check now supports automated repair. The repair creates a `.venv` virtual environment in the current working directory using the detected Python command (`python3`/`python`). `verify()` confirms the activation script exists. `rollback()` removes the `.venv` directory with `fs.rmSync`.
- **`NodePlugin.canRepair()` and `PythonPlugin.canRepair()`** — Both plugins now declare repair eligibility explicitly, consistent with `MysqlPlugin`.
- **Unit tests for new repair/rollback paths** (`src/plugins/node/index.test.ts`, `src/plugins/python/index.test.ts`) — Mocked unit tests covering `canRepair`, successful repair, rollback from saved state, and edge cases.

### Changed

- **`devdoctor rollback` help text** — Updated supported checks list to include `node-permissions` and `python-venv` alongside the existing `mysql-service` and `xampp-process`.
- **ADR-0015** — Updated to document all three plugins with rollback support and their specific rollback strategies.
- **Markdown renderer `formatTimestamp`** — Changed from `toLocaleString()` (locale/timezone-dependent) to `toISOString()` (deterministic UTC). Saved Markdown reports now use unambiguous ISO 8601 timestamps that are consistent across all machines and CI environments. This was the root cause of snapshot test mismatches between machines.
- **Renderer snapshots regenerated** — All 10 Markdown renderer snapshots updated to reflect the ISO timestamp format. Snapshots are now fully deterministic.
- Test suite grows from 122 to 130 tests across 19 test files.

### Fixed

- **Snapshot test mismatch on CI / different timezones** — `MarkdownRenderer.formatTimestamp()` previously called `toLocaleString()`, which renders differently depending on the machine's locale and timezone. This caused snapshot assertions to fail on any machine with a different timezone than the one that generated the snapshots. Fixed by switching to `toISOString()`.

---

## [0.4.1] — 2026-07-13

### Added

- **Snapshot tests for renderer output** (`src/cli/reporting/renderers.snapshot.test.ts`) — 10 snapshot cases covering `JsonRenderer` and `MarkdownRenderer` across five fixture variants each: all-passing, mixed pass/warn/fail, `dependsOn`-skipped checks, unhealthy doctor result, and fully healthy doctor result. Any accidental change to heading text, table columns, field ordering, or whitespace is now immediately visible as a diff in CI. (suggestion #19)
- **Snapshot tests for `applyDependencySkips`** (`src/core/engine/status-utils.snapshot.test.ts`) — 9 snapshot cases covering the dependency skip utility: no deps, all deps pass, root fails (full cascade), middle dep fails (partial cascade), warn dep treated as not-pass, unknown dep reference, field preservation on skipped checks, empty array, and single check. Pins the exact transformed check arrays so regression is caught precisely.

### Changed

- Test suite grows from 103 to 122 tests across 17 test files. 19 snapshots written on first run.

---

## [0.4.0] — 2026-07-13

### Added

- **Redis plugin** (`src/plugins/redis/`) — Five diagnostic checks with full dependency-aware ordering: binary installation, system service status, port 6379 ownership, PING/PONG connectivity, and memory usage vs `maxmemory` limit. All checks use `applyDependencySkips()` so downstream checks skip cleanly when Redis is not installed. (ADR-0018)
- **Python plugin** (`src/plugins/python/`) — Four diagnostic checks: Python 3 installation (`python3`/`python` with Python 2 detection), pip availability (tries `pip3`, `pip`, `python -m pip`), active virtual environment (`VIRTUAL_ENV` / Conda), and PATH ordering conflict detection for pyenv/Conda/user-install vs system Python. (ADR-0018)
- **`devdoctor history`** — New command that reads `~/.devdoctor/runs.json` and renders a health score timeline with trend arrows (↑↓→), per-run progress bars, and plugin-level status badges on degraded rows. Supports `--last <n>` and `--format json`. (ADR-0016)
- **`devdoctor rollback <plugin> <check>`** — New command to manually trigger a rollback of the last automated repair. Routes through `RepairEngine.runRollback()` for audit logging, requires interactive confirmation or `--yes`, guards against non-TTY environments, and suggests a follow-up `diagnose` run. (ADR-0015)
- **Dependency-aware check ordering** — `DiagnosticCheck` now has an optional `dependsOn?: string[]` field. The new `applyDependencySkips()` utility in `status-utils.ts` substitutes a `skip` result for any check whose named dependencies did not pass, eliminating confusing false negatives. Used by Redis and Python plugins. (ADR-0017)
- **Diagnostic history store** — `FileHistoryStore` (`src/infra/audit/history-store.ts`) appends a lightweight `HistoryEntry` snapshot to `~/.devdoctor/runs.json` after every `devdoctor doctor` run. Injected into the `doctor` command at the Composition Root. (ADR-0016)
- **Interactive menu — history and rollback entries** — The arrow-key menu now includes "Health history" (📈) and "Roll back a repair" (↩️) entries. Rollback prompts for plugin → check name → auto-confirm before dispatching.
- **Plugin contract test timeout override** — `testPluginContract()` now accepts an optional `timeout` parameter. The Python plugin contract test uses 15 s to accommodate multi-subprocess PATH discovery on Windows.
- **ADR-0015** — Explicit rollback command design documented.
- **ADR-0016** — Diagnostic history and health score trending documented.
- **ADR-0017** — Dependency-aware check ordering documented.
- **ADR-0018** — Redis and Python plugin decisions documented.

### Changed

- **`devdoctor doctor`** — Accepts an optional `IHistoryStore` parameter (injected at Composition Root). Appends a `HistoryEntry` after every run when a store is provided.
- **`status-utils.ts`** — Exports `applyDependencySkips()` alongside the existing `deriveOverallStatus()`.
- **`plugin-contract.test.ts`** — Updated to cover Redis and Python plugins (20 tests, up from 12).
- **`plugin-loader.ts`** — `RedisPlugin` and `PythonPlugin` added to `BUILTIN_PLUGINS`.
- **`path-check.ts` (Python)** — `where`/`which` command limited to 3 s timeout to prevent slow PATH searches from blocking the diagnostic run on Windows.
- **`pip-check.ts` (Python)** — `python -m pip` fallback limited to 5 s timeout.
- **Interactive menu** — Tip footer and `lineCount` accounting already present from 0.3.1 — no further changes needed.

---

## [0.3.1] — 2026-07-13

### Added

- **Interactive secondary prompts** — After selecting a command in the arrow-key menu, a short follow-up prompt surfaces the most useful flags without requiring knowledge of CLI syntax:
  - `diagnose` → "Show verbose output for all checks?" (maps to `--verbose`)
  - `fix` → "Preview repairs without making changes?" (`--dry-run`), then if not dry-run, "Auto-confirm all repairs without prompting?" (`--yes`)
  - `doctor` → "Output format?" — choose terminal / json / markdown (`--format`)
  - `info` → "Output format?" — choose terminal / json (`--format`)
  - `env` → "Show only the PATH breakdown?" (`--path`), then "Show ALL environment variables?" (`--all`)
- **Interactive menu tip footer** — A muted hint line at the bottom of the main menu reads `Tip: Run devdoctor --help or devdoctor <command> --help for advanced flags.`, guiding power users toward the full CLI surface.

---

## [0.3.0] — 2026-07-13

### Added

- **Git plugin** (`src/plugins/git/`) — Four diagnostic checks: Git installation and version, global identity (`user.name` / `user.email`), default branch name (`init.defaultBranch`), and SSH key presence in `~/.ssh`.
- **`--quiet` / `-q` flag** — A global flag that suppresses all banners, loading spinners, and ANSI color codes to make DevDoctor entirely machine-readable and suitable for CI pipelines.
- **Interactive menu mode** — Running `devdoctor` with no arguments in a TTY now shows an arrow-key navigation menu instead of the help screen. Esc or `q` exits; non-TTY environments (pipes, CI) fall back to help output unchanged.
- **Shell completions** (`devdoctor completion <shell>`) — Generates ready-to-source tab-completion scripts for `bash`, `zsh`, `fish`, and `pwsh`. Plugin names and `--format` values are included as completions.
- **`--format json` on `info` and `env`** — Both commands now accept `-f, --format json` for machine-readable stdout output, consistent with `diagnose` and `doctor`. Banner and spinner are suppressed in JSON mode.
- **State transition diff on `fix`** — After a successful repair and verification, a before/after block is rendered showing the prior state, the resolved state, and the action taken.
- **`src/core/engine/status-utils.ts`** — Shared `deriveOverallStatus` utility extracted from the three plugin implementations that each duplicated it.
- **Plugin contract test suite** (`src/plugins/plugin-contract.test.ts`) — Generic contract harness that validates every registered plugin satisfies the `Plugin` interface. Runs for `node`, `mysql`, and `git`.
- **ADR-0013** — Plugin contract testing strategy documented.
- **ADR-0014** — Quiet mode for CI pipelines documented.
- **CI runs on `dev` branch** — CI workflow now triggers on pushes and PRs targeting `main`, `master`, and `dev`.
- **Release restricted to `main`** — The release workflow now only fires for `v*` tags originating from `main`, preventing accidental releases from feature branches.

### Fixed

- **Unused imports in `diagnose.ts`** — `defaultOutputFilename` and `connector` were imported but never used; both removed.
- **`ssh-check.ts` uses async fs** — Replaced synchronous `fs.existsSync` / `fs.readdirSync` with `fs/promises` `readdir`, consistent with the async function signature.

### Changed

- **SSH check detail and suggestion copy** — The pass-path detail now notes that key files must have correct permissions (600) and be loaded in `ssh-agent`. The fail-path suggestion now includes the full `ssh-add` step and a note to register the public key with the hosting provider.
- **`deriveOverallStatus` centralised** — `node/index.ts`, `mysql/index.ts`, and `git/index.ts` now all import from `status-utils.ts` instead of each carrying a local copy.

---

## [0.2.2] — 2026-07-13

### Changed

- **Spinner transitions** — Spinners now call `.succeed()` with a completion summary instead of silently stopping, giving clear visual feedback before output appears (#9).
- **Doctor health check completion** — The doctor spinner now reports how many issues were found (or confirms all plugins healthy) when it finishes (#11).
- **Fix `--yes` preamble** — When `--yes` is active, a list of repairs about to be applied is printed before execution begins (#13).
- **Fix pre-repair diagnosis label** — The diagnosis spinner in `fix` now reads "Pre-repair diagnosis" to distinguish it from a standalone `diagnose` run (#10).
- **Fix elapsed time in summary** — The fix command summary now shows total elapsed time (#12).
- **Fix skip message clarity** — Declined repairs now show an inline "→ Skipping." acknowledgment immediately after the user presses Enter (#7).
- **Doctor recommendations includes warnings** — Checks with `warn` status and a suggestion now appear in the Recommendations section, not just `fail` checks (#4).
- **Env value truncation respects terminal width** — Variable values are now truncated based on `process.stdout.columns` rather than a hardcoded 60-char limit (#5).
- **Info memory bar has a Usage label** — The memory progress bar in `devdoctor info` now has a "Usage" prefix for context (#6).
- **"Use --verbose" tip is conditional** — The tip only appears when at least one passing check has suppressed detail content (#2).
- **Tree style unified in fix** — The no-repairs warning path now uses the same connector style as the repair path (#3).

### Fixed

- **Spinner/error competition** — Spinner now stops silently before error blocks are printed, preventing double messages (#1).
- **Error paths have "what to do next" hints** — Unknown plugin and TTY error messages now end with a hint to run `--help` (#8).

---

## [0.2.1] — 2026-07-13

### Fixed

- **Dead code removed from `fix.ts`** — Unused variables (`plugin`, `pluginRef`, `repairableIssues`, `c`) left over from the 0.2.0 RepairEngine refactor have been removed.
- **`canRepair()` now correctly consulted** — The fix command previously bypassed `canRepair()` entirely and filtered repairs using a `status === 'fail'` heuristic. The plugin's `canRepair()` predicate is now called for each check, so plugins that explicitly return `false` for a check are no longer offered as repairs.
- **Empty PATH entries now detected** — `parsePath()` was calling `.filter(Boolean)` which silently dropped empty entries (from `;;` or leading/trailing separators). These are now preserved as `'.'` so the security risk detector in `devdoctor env` can flag them correctly.
- **Markdown report timestamps use local time** — `formatTimestamp()` in the Markdown renderer was calling `toISOString()` which always outputs UTC. Timestamps in saved reports now use locale-aware formatting with the local timezone name.
- **`writeProjectConfig()` has a path traversal guard** — Consistent with `writeReport()`, the config writer now validates that the resolved output path stays within `process.cwd()` before writing.
- **Version string no longer hardcoded in CLI** — `src/cli/index.ts` now reads the version from `package.json` via `createRequire`. A version bump now only requires changing `package.json`.

---

## [0.2.0] — 2026-07-13

### Added

- **`devdoctor fix --yes` / `-y`** — Auto-confirm all repairs without prompting. Intended for CI pipelines and scripted environments where no TTY is available.
- **`devdoctor fix --dry-run`** — Preview which repairs would be applied without making any changes. Exits with code 1 if issues exist, making it usable as a CI health check.
- **RepairEngine** (`src/core/engine/repair-engine.ts`) — New core engine that wraps all repair, verification, and rollback operations. The `fix` command now routes through this engine rather than calling plugins directly, enabling consistent error handling and audit logging across all repair actions.
- **Repair audit log** (`~/.devdoctor/history.json`) — Every repair, verification, and rollback action is appended as an NDJSON entry recording the plugin, check name, action type, success/failure, and result message. The `FileAuditLogger` and `nullAuditLogger` (no-op) implementations are both available; the file logger is active by default.
- **Concurrent plugin diagnostics** — `DiagnosticEngine.runAll()` now dispatches all plugins in parallel via `Promise.allSettled()` instead of sequentially. A single failing plugin no longer blocks the rest.
- **Per-plugin timeout in `runAll()`** — Each plugin is limited to 30 seconds via `Promise.race()`. A timed-out plugin produces a `skip` result rather than hanging the `doctor` dashboard indefinitely.
- **Environment security risk detection** (`devdoctor env`) — Three new detectors surface security misconfigurations:
  - `.` or empty entry in `PATH` (privilege escalation vector, severity: fail)
  - World-writable `PATH` directories on Unix (severity: warn)
  - Environment variable names matching secret patterns (`*_TOKEN`, `*_KEY`, `*_SECRET`, `*_PASSWORD`, etc.) with token-like values — variable name only is reported, values are never echoed (severity: warn)
- **Concurrent fix guard** — A lockfile at `~/.devdoctor/fix.lock` prevents two `fix` runs from interfering with each other. Stale locks from dead processes are detected via PID existence check and cleaned up automatically.
- **ADR-0009** — Security hardening decisions documented.
- **ADR-0010** — RepairEngine, concurrent diagnostics, and fix UX decisions documented.
- **ADR-0011** — Repair audit log design decisions documented.
- **ADR-0012** — Environment security risk detection decisions documented.

### Changed

- **`devdoctor fix`** — Repairs now route through `RepairEngine` instead of the plugin directly. Behavior is identical from the user's perspective but the internal path is now consistent with how diagnostics flow through `DiagnosticEngine`.
- **TTY guard on `fix`** — When stdin is not an interactive terminal and neither `--yes` nor `--dry-run` is provided, the command now fails immediately with a clear message and exit code 1 instead of hanging on the readline prompt.
- **`devdoctor env`** — Adds a **Security Risks** section to output when any risks are detected. The section is omitted entirely on clean environments.
- **`devdoctor doctor`** — Plugin checks now run concurrently; the dashboard is noticeably faster with multiple plugins registered.

### Security

- **Shell injection hardening** (`command-runner.ts`) — Arguments passed through Windows shell (`exec()`) mode are sanitized by stripping `cmd.exe` metacharacters (`&`, `|`, `<`, `>`, `^`, `` ` ``) before the command string is assembled. See ADR-0009.
- **Path traversal protection** (`renderer-factory.ts`) — `writeReport()` now resolves and validates the output path against the allowed output directory before writing. A `reportOutputDir` set to a path like `../../../../etc/` in a malicious `devdoctor.json` is rejected. See ADR-0009.
- **Process name allowlist** (`process-manager.ts`) — Windows `tasklist /fi` filters now validate the process name against the pattern `*.exe` before interpolation, preventing filter injection. See ADR-0009.
- **PID cross-check before kill** (`plugins/mysql/index.ts`) — The `mysql-port` repair re-queries the port owner immediately before issuing the kill and aborts if the PID or process name changed, mitigating the PID recycling race condition. See ADR-0009.
- **Elevation-aware `systemctl` on Unix** (`plugins/mysql/index.ts`) — `sudo -n` (non-interactive) is used instead of `sudo`, failing immediately with a clear error rather than hanging for a password prompt. Root processes skip `sudo` entirely. See ADR-0009.
- **mysqld TCP startup probe** (`process-manager.ts`) — The previous fixed 2-second sleep after spawning `mysqld` is replaced with a TCP port polling loop (`waitForPort()`). The probe returns as soon as the port accepts connections or a 10-second timeout expires. See ADR-0009.

---

## [0.1.0] — 2026-07-01

### Added

- Initial release.
- **`devdoctor diagnose <plugin>`** — Run health checks for a specific plugin with `--verbose`, `--format` (terminal/json/markdown), and `--output` options.
- **`devdoctor fix <plugin>`** — Interactive repair workflow with per-check confirmation, post-repair verification, and rollback support.
- **`devdoctor doctor`** — Full health dashboard across all plugins with health score, tool detection, and recommendations.
- **`devdoctor info`** — System information (OS, CPU, memory, runtime, installed tools).
- **`devdoctor env`** — Development environment variables grouped by category with PATH validation.
- **Node.js plugin** — Checks Node.js installation, version (LTS detection), npm, PATH configuration, and permissions.
- **MySQL plugin** — Checks service status, port availability, configuration file, error log, permissions, and XAMPP process detection. Supports automated repair for service start, port conflict resolution, and XAMPP mysqld spawn with rollback.
- **Plugin system** — Dynamic filesystem plugin discovery and loading via `import()` with runtime type validation.
- **Configuration system** — Two-tier config resolution (`~/.devdoctor/config.json` + `./devdoctor.json`) with per-plugin disable flags.
- **Reporting** — JSON and Markdown renderers with `--output` file support.
- **Standalone binaries** — Windows, Linux, and macOS binaries via `@yao-pkg/pkg`.
- **CI workflow** — GitHub Actions matrix testing on Node.js 18, 20, and 22.
- **Release workflow** — Automated binary builds and GitHub Packages npm publish on version tags.
- **ADR-0001 through ADR-0008** — Architecture Decision Records covering TypeScript, Clean Architecture, plugin architecture, repair/rollback strategy, configuration system, dynamic plugin loading, reporting strategy, and packaging.

[0.4.8]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.4.7...v0.4.8
[0.4.7]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/m0rPleX-16/DevDoctor/releases/tag/v0.1.0
