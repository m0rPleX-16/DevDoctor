# Changelog

All notable changes to Dev Doctor are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.0]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/m0rPleX-16/DevDoctor/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/m0rPleX-16/DevDoctor/releases/tag/v0.1.0
