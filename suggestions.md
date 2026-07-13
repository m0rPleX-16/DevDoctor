# DevDoctor — Improvement Suggestions

> Compiled on 2026-07-13 based on a review of the v0.2.2 codebase.
> Each suggestion is tagged with an estimated effort and priority.

---

## 🎨 UX Improvements

### 1. Interactive Mode
**Priority:** High · **Effort:** Medium

When running `devdoctor` with no arguments, instead of dumping the help screen, offer an interactive menu using arrow-key navigation (e.g. via `inquirer` or raw `readline`). Users pick "Diagnose", "Fix", "Doctor", etc. from a styled list.

**Why:** Much more approachable for non-developers and first-time users who don't know the available commands.

```
  ╷
  │  ✦ Dev Doctor  v0.2.2
  ╵
  ? What would you like to do?
  ❯ 🩺 Run full health check (doctor)
    🔍 Diagnose a specific plugin
    🔧 Fix issues for a plugin
    ℹ️  Show system info
    📋 Show environment variables
```

---

### 2. `--quiet` / `--json` Flags on All Commands
**Priority:** High · **Effort:** Low

CI pipelines need machine-parseable output. A `--quiet` flag suppresses all decoration (banners, spinners, colors) and exits with a non-zero code on failure.

**Why:** Useful for integrating DevDoctor into pre-commit hooks, CI gates, or scripted pipelines.

```bash
# CI usage example
devdoctor doctor --quiet || echo "Environment unhealthy"

# Pipe JSON to jq
devdoctor doctor --format json --quiet | jq '.health.percentage'
```

---

### 3. Shell Completions
**Priority:** Medium · **Effort:** Low

Generate tab-completion scripts for bash/zsh/powershell. Commander supports this natively via helper methods.

```bash
# Users type:
devdoctor diag<TAB>    → devdoctor diagnose
devdoctor diagnose <TAB>  → mysql  node
```

**Why:** Reduces friction for power users and helps discoverability of available plugins.

---

### 4. Colored Diff on Fix
**Priority:** Medium · **Effort:** Medium

After a repair succeeds, show a before/after diff of what changed:

```
  ┃  Port 3306
  │  Before:  ❌ occupied by PID 1234 (mysqld_safe)
  │  After:   ✅ free
  │  Action:  Terminated PID 1234
```

**Why:** Currently the user only sees "repair succeeded" without seeing the state transition. A diff builds confidence that the fix did the right thing.

---

## ⚙️ Process & Architecture Improvements

### 5. Diagnostic History & Trending
**Priority:** High · **Effort:** Medium

Store each `doctor` run result as a timestamped JSON file in `~/.devdoctor/history/`. Add a `devdoctor history` command that shows a timeline of health scores.

```
  Health Score History
  ─────────────────────────────────
  2026-07-10  92%  ████████████████████████████░░  All healthy
  2026-07-11  78%  ███████████████████████░░░░░░░  MySQL port conflict
  2026-07-12  65%  ███████████████████░░░░░░░░░░░  MySQL + Node PATH issue
  2026-07-13  95%  █████████████████████████████░  Fixed via devdoctor fix
```

**Why:** Helps users identify *when* their environment degraded and correlate it with changes they made (installed new software, updated configs, etc.).

---

### 6. Pre-Fix Snapshots & Rollback
**Priority:** High · **Effort:** High

Before any repair, snapshot the current state (service status, port map, config file contents) into a rollback manifest at `~/.devdoctor/snapshots/<timestamp>.json`. Add a `devdoctor rollback` command to undo the last fix.

```bash
devdoctor fix mysql          # Saves snapshot, then repairs
devdoctor rollback           # Restores previous state
devdoctor rollback --list    # Shows available snapshots
```

**Why:** Currently fixes are one-way — killing a PID or starting a service can't be reversed. Rollback gives users a safety net, especially on shared or production-adjacent machines.

---

### 7. Dependency-Aware Check Ordering
**Priority:** Medium · **Effort:** Medium

Some checks depend on others. For example, there's no point checking MySQL port availability if the MySQL service isn't installed. Define a `dependsOn` field in check definitions:

```typescript
interface Check {
  name: string;
  dependsOn?: string[];  // Names of checks that must pass first
  run(): Promise<CheckResult>;
}
```

The engine skips downstream checks early and shows:
```
  ⏭  Port 3306 check  — Skipped (MySQL service not found)
```

**Why:** Avoids confusing false negatives and reduces noise in diagnostic output.

---

### 8. Parallel Plugin Diagnostics
**Priority:** Low · **Effort:** Medium

The `doctor` command currently runs plugins sequentially. For users with 5+ plugins, running them in parallel via `Promise.allSettled()` (with a concurrency limiter like `p-limit`) would cut wall-clock time significantly.

Show a multi-spinner (one line per plugin) updating live:

```
  ✓ node      6 checks  42ms
  ⠸ mysql     checking port 3306...
  ⠸ docker    checking daemon status...
  ◌ redis     queued
```

**Why:** As the plugin count grows, sequential execution becomes a bottleneck.

---

## 🔌 Plugin & Feature Expansion

### 9. Docker Plugin
**Priority:** High · **Effort:** Medium

| Check | What it validates |
|-------|-------------------|
| Daemon status | Docker Desktop or `dockerd` is running |
| Docker Compose | `docker compose version` succeeds |
| Disk usage | Dangling images/volumes consuming excessive disk |
| Port conflicts | Container port bindings conflicting with host services |
| Network | Default bridge network is healthy |

---

### 10. Git Plugin
**Priority:** High · **Effort:** Low

| Check | What it validates |
|-------|-------------------|
| Installation | `git --version` succeeds |
| Identity | `user.name` and `user.email` are configured |
| SSH keys | `~/.ssh/id_*` exists and `ssh -T git@github.com` succeeds |
| Remote connectivity | Can reach configured remotes |
| Large repo settings | `core.fsmonitor`, `feature.manyFiles` for perf |

---

### 11. PostgreSQL Plugin
**Priority:** Medium · **Effort:** Medium

| Check | What it validates |
|-------|-------------------|
| Service status | `postgresql` service running |
| Port 5432 | Not occupied by a conflicting process |
| `pg_hba.conf` | Authentication mode (trust/md5/scram) |
| Connection test | `psql -c "SELECT 1"` succeeds |

---

### 12. Redis Plugin
**Priority:** Medium · **Effort:** Low

| Check | What it validates |
|-------|-------------------|
| Service status | `redis-server` running |
| Port 6379 | Listening and reachable |
| Memory usage | `INFO memory` within acceptable bounds |
| Persistence | RDB/AOF config status |

---

### 13. Python Plugin
**Priority:** Medium · **Effort:** Medium

| Check | What it validates |
|-------|-------------------|
| Python version | `python --version` or `python3 --version` |
| pip | `pip --version` succeeds |
| Virtualenv | Active venv detected, `VIRTUAL_ENV` set |
| PATH conflicts | System Python vs user Python vs pyenv ordering |

---

### 14. Network Plugin
**Priority:** Low · **Effort:** High

| Check | What it validates |
|-------|-------------------|
| DNS resolution | Can resolve `github.com`, `registry.npmjs.org` |
| Proxy env vars | `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` sanity |
| SSL certificates | Chain validation for common registries |
| Localhost | Ports 3000, 8080, 8443 reachability |

---

## 📊 Reporting & Observability

### 15. HTML Report Renderer
**Priority:** Medium · **Effort:** Medium

Add `--format html` that generates a self-contained HTML file with:
- Collapsible sections per plugin
- Syntax-highlighted config snippets
- An embedded health-score gauge chart
- Responsive layout for mobile viewing

**Why:** Shareable via email or Slack without requiring a terminal. Non-developers can open it in a browser.

---

### 16. CI Badge Endpoint
**Priority:** Low · **Effort:** Low

Generate a badge SVG (like shields.io) from the last `doctor` result:

```bash
devdoctor doctor --badge ./devdoctor-badge.svg
```

Teams embed it in their project README:
```markdown
![DevDoctor](./devdoctor-badge.svg)
```

Shows health score with color coding (green/yellow/red).

---

### 17. Webhook Notifications
**Priority:** Low · **Effort:** Medium

Add a `--notify` flag or `devdoctor.json` config option to POST results to Slack/Discord/Teams when health drops below a threshold:

```json
{
  "notifications": {
    "webhook": "https://hooks.slack.com/services/...",
    "threshold": 80
  }
}
```

**Why:** Useful for shared dev environments or staging servers where degradation should alert the team.

---

## 🧪 Testing & Quality

### 18. Integration Test Suite
**Priority:** High · **Effort:** Medium

Currently all 83 tests are unit tests with mocks. Add a small integration test suite (guarded by an environment variable) that runs real `diagnose node` and verifies the output structure against the `DiagnosticResult` type.

```typescript
describe.skipIf(!process.env.INTEGRATION)('integration', () => {
  it('diagnose node returns valid DiagnosticResult', async () => {
    const result = await engine.runDiagnostics('node');
    expect(result).toBeDefined();
    expect(result!.checks.length).toBeGreaterThan(0);
  });
});
```

---

### 19. Snapshot Tests for CLI Output
**Priority:** Medium · **Effort:** Low

Use Vitest's `toMatchSnapshot()` on the terminal renderer output to catch unintended formatting regressions:

```typescript
it('renders diagnostic result consistently', () => {
  const output = renderer.renderDiagnostic(mockResult);
  expect(output).toMatchSnapshot();
});
```

**Why:** Formatting changes across `diagnose`, `doctor`, and `fix` are easy to introduce accidentally. Snapshots make regressions immediately visible in PR diffs.

---

### 20. Plugin Contract Tests
**Priority:** Medium · **Effort:** Low

A generic test harness that takes any `Plugin` implementation and validates it satisfies the contract:

```typescript
function testPluginContract(plugin: Plugin) {
  it('returns a valid DiagnosticResult', async () => {
    const result = await plugin.diagnose();
    expect(result.pluginName).toBe(plugin.name);
    expect(result.checks).toBeInstanceOf(Array);
    expect(result.checks.length).toBeGreaterThan(0);
    for (const check of result.checks) {
      expect(['pass', 'fail', 'warn', 'skip']).toContain(check.status);
    }
  });

  it('does not throw on missing tools', async () => {
    await expect(plugin.diagnose()).resolves.toBeDefined();
  });
}
```

Run automatically for every registered plugin to ensure consistency.

---

## Priority Roadmap

| Phase | Items | Focus |
|-------|-------|-------|
| **Phase A** | #1, #2, #5, #18 | Core UX polish + history + integration tests |
| **Phase B** | #4, #6, #7, #19, #20 | Fix UX + safety + test quality |
| **Phase C** | #9, #10, #3 | Docker + Git plugins + shell completions |
| **Phase D** | #11, #12, #13, #8 | More plugins + parallel execution |
| **Phase E** | #15, #16, #17, #14 | Reporting + observability + network plugin |
