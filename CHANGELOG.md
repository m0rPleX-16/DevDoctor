# Changelog

All notable changes to Dev Doctor are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
