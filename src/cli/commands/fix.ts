/**
 * Fix Command
 *
 * The `devdoctor fix <plugin>` command.
 *
 * Runs diagnostics, prompts the user interactively before fixing (unless
 * --yes is provided), executes repairs via RepairEngine, and performs
 * post-repair verifications to ensure issues are resolved.
 *
 * ADR-0010:
 * - Repairs are now routed through RepairEngine, not directly to plugins.
 * - --yes / -y: auto-confirm all repairs (for CI/scripted environments).
 * - --dry-run: list what would be repaired without making any changes.
 * - TTY detection: fails fast when stdin is non-interactive and --yes is absent.
 *
 * ADR-0011:
 * - All repair/verify/rollback actions are logged to ~/.devdoctor/history.json.
 *
 * 0.2.1 fixes:
 * - Removed dead code (unused plugin/pluginRef/repairableIssues variables).
 * - canRepair() is now consulted via the registry for accurate pre-filtering.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Command } from 'commander';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import type { DiagnosticEngine } from '../../core/engine/diagnostic-engine.js';
import type { RepairEngine } from '../../core/engine/repair-engine.js';
import type { PluginRegistry } from '../../plugins/plugin-registry.js';
import { createSpinner } from '../ui/spinner.js';
import { showCompactBanner } from '../ui/banner.js';
import {
  theme,
  hr,
  statusBadge,
  statusColor,
} from '../ui/formatter.js';

// ── Lockfile ──────────────────────────────────────────────────────

const LOCK_DIR = path.join(os.homedir(), '.devdoctor');
const LOCK_FILE = path.join(LOCK_DIR, 'fix.lock');

/**
 * Acquire a simple lockfile to prevent concurrent fix runs on the same machine.
 * Returns a release function that removes the lockfile.
 *
 * @throws Error if the lock is already held by another process
 */
function acquireLock(): () => void {
  try {
    if (!fs.existsSync(LOCK_DIR)) {
      fs.mkdirSync(LOCK_DIR, { recursive: true });
    }

    // Check for a stale lock from a dead process
    if (fs.existsSync(LOCK_FILE)) {
      const content = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      const lockedPid = parseInt(content, 10);

      let processRunning = false;
      try {
        process.kill(lockedPid, 0); // Signal 0 = existence check, no signal sent
        processRunning = true;
      } catch {
        processRunning = false;
      }

      if (processRunning) {
        throw new Error(
          `Another devdoctor fix is already running (PID: ${lockedPid}). ` +
            `If this is incorrect, delete ${LOCK_FILE} and try again.`,
        );
      }
      // Stale lock — remove it
      fs.unlinkSync(LOCK_FILE);
    }

    // Write our PID to the lockfile
    fs.writeFileSync(LOCK_FILE, String(process.pid), { encoding: 'utf-8', flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(
        `Another devdoctor fix is already running. If this is incorrect, delete ${LOCK_FILE} and try again.`,
      );
    }
    throw err;
  }

  return () => {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {
      // Best-effort cleanup
    }
  };
}

// ── Confirmation prompt ───────────────────────────────────────────

async function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(query);
    const normalized = answer.toLowerCase().trim();
    return normalized === 'y' || normalized === 'yes';
  } finally {
    rl.close();
  }
}

// ── Command factory ───────────────────────────────────────────────

interface FixOptions {
  yes?: boolean;
  dryRun?: boolean;
}

export function createFixCommand(
  registry: PluginRegistry,
  engine: DiagnosticEngine,
  repairEngine: RepairEngine,
): Command {
  return new Command('fix')
    .description('Safely repair issues detected by a plugin.')
    .argument('<plugin>', 'The technology plugin to fix (e.g., node, mysql)')
    .option('-y, --yes', 'Auto-confirm all repairs without prompting (for CI/scripted use)')
    .option('--dry-run', 'Show what would be repaired without making any changes')
    .action(async (pluginName: string, options: FixOptions) => {
      const autoConfirm = options.yes ?? false;
      const dryRun = options.dryRun ?? false;

      showCompactBanner();

      const plugin = registry.get(pluginName);
      if (!plugin) {
        console.log();
        console.log(`  ${theme.error(`✖ Unknown plugin: "${pluginName}"`)}`);
        console.log();
        console.log(`  ${theme.muted('Available plugins:')}`);
        for (const name of engine.getAvailablePlugins()) {
          console.log(`    ${theme.primary('›')} ${chalk.white(`devdoctor fix ${name}`)}`);
        }
        console.log();
        console.log(`  ${theme.muted('Run')} ${chalk.white('devdoctor --help')} ${theme.muted('to see all available commands and options.')}`);
        console.log();
        process.exitCode = 1;
        return;
      }

      // ADR-0010: TTY guard
      if (!autoConfirm && !dryRun && !process.stdin.isTTY) {
        console.log();
        console.log(`  ${theme.error('✖ Interactive mode requires a TTY.')}`);
        console.log(`  ${theme.muted('Use')} ${chalk.white('--yes')} ${theme.muted('to auto-confirm repairs in non-interactive environments:')}`);
        console.log(`    ${chalk.cyan(`devdoctor fix ${pluginName} --yes`)}`);
        console.log(`  ${theme.muted('Use')} ${chalk.white('--dry-run')} ${theme.muted('to preview what would be repaired:')}`);
        console.log(`    ${chalk.cyan(`devdoctor fix ${pluginName} --dry-run`)}`);
        console.log();
        console.log(`  ${theme.muted('Run')} ${chalk.white('devdoctor --help')} ${theme.muted('to see all available commands and options.')}`);
        console.log();
        process.exitCode = 1;
        return;
      }

      // Acquire lockfile (skip in dry-run — no changes are made)
      let releaseLock: (() => void) | undefined;
      if (!dryRun) {
        try {
          releaseLock = acquireLock();
        } catch (err) {
          console.log();
          console.log(`  ${theme.error(`✖ ${err instanceof Error ? err.message : String(err)}`)}`);
          console.log();
          console.log(`  ${theme.muted('Run')} ${chalk.white('devdoctor --help')} ${theme.muted('to see all available commands and options.')}`);
          console.log();
          process.exitCode = 1;
          return;
        }
      }

      try {
        await runFix(pluginName, plugin.displayName, autoConfirm, dryRun, registry, engine, repairEngine);
      } finally {
        releaseLock?.();
      }
    });
}

// ── Core fix logic ────────────────────────────────────────────────

async function runFix(
  pluginName: string,
  displayName: string,
  autoConfirm: boolean,
  dryRun: boolean,
  registry: PluginRegistry,
  engine: DiagnosticEngine,
  repairEngine: RepairEngine,
): Promise<void> {
  const startTime = performance.now();
  const diagSpinner = createSpinner(`Pre-repair diagnosis: ${displayName}...`);
  const result = await engine.runDiagnostics(pluginName);
  diagSpinner.succeed(`Diagnosis complete — ${result?.checks.length ?? 0} checks in ${result?.durationMs ?? 0}ms`);

  if (!result) {
    console.log(`  ${theme.error('✖ Failed to obtain diagnostic results.')}`);
    console.log();
    process.exitCode = 1;
    return;
  }

  const issues = result.checks.filter((c) => c.status === 'fail' || c.status === 'warn');

  // Fix #2: consult canRepair() from the actual plugin instance.
  // Previously this was bypassed with a `status === 'fail'` heuristic,
  // meaning plugins that explicitly declare canRepair() === false were
  // still offered as repairs.
  const plugin = registry.get(pluginName);
  const repairableIssues = issues.filter((c) => {
    if (plugin?.canRepair) {
      return plugin.canRepair(c.name);
    }
    // Fallback for plugins that don't implement canRepair: only fail-status checks
    return c.status === 'fail';
  });

  console.log();
  console.log(`  ${hr(displayName + ' Repairs', 48)}`);

  if (dryRun) {
    console.log();
    console.log(`  ${theme.warning('⚠ Dry run — no changes will be made.')}`);
  }

  if (issues.length === 0) {
    console.log();
    console.log(`  ${statusBadge('pass')}  ${theme.success('No issues found. Your environment is healthy!')}`);
    console.log();
    console.log(`  ${hr(undefined, 48)}`);
    console.log();
    return;
  }

  if (repairableIssues.length === 0) {
    console.log();
    console.log(`  ${statusBadge('warn')}  ${theme.warning(`Found ${issues.length} issue(s), but none have automated repairs.`)}`);
    console.log();
    for (const check of issues) {
      console.log(`  ${theme.primary('┃')} ${statusBadge(check.status)}  ${statusColor(check.label, check.status)}`);
      console.log(`  ${theme.primary('│')}     ${theme.muted(check.message)}`);
      if (check.suggestion) {
        console.log(`  ${theme.primary('│')}     ${chalk.hex('#A78BFA')('💡 ' + check.suggestion)}`);
      }
      console.log(`  ${theme.primary('│')}`);
    }
    console.log(`  ${hr(undefined, 48)}`);
    console.log();
    return;
  }

  console.log();
  if (dryRun) {
    console.log(`  ${theme.primary(`ℹ ${repairableIssues.length} repair(s) would be applied:`)}`);
  } else {
    console.log(`  ${theme.warning(`⚠ Found ${repairableIssues.length} repairable issue(s).`)}`);
  }

  if (issues.length > repairableIssues.length) {
    const unrepairable = issues.length - repairableIssues.length;
    console.log(`  ${theme.muted(`  (${unrepairable} additional issue(s) have no automated repair — see diagnose output.)`)}`);
  }
  console.log();

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  if (autoConfirm && !dryRun && repairableIssues.length > 0) {
    console.log(`  ${theme.warning(`⚡ Auto-confirm active. Applying ${repairableIssues.length} repair(s):`)}`);
    for (const check of repairableIssues) {
      console.log(`  ${theme.muted('  ›')} ${chalk.white(check.label)}`);
    }
    console.log();
  }

  for (const check of repairableIssues) {
    console.log(`  ${theme.primary('┃')}  ${statusColor(check.label, check.status)}`);
    console.log(`  ${theme.primary('│')}  Current state: ${theme.muted(check.message)}`);
    if (check.suggestion) {
      console.log(`  ${theme.primary('│')}  Proposal: ${chalk.hex('#A78BFA')(check.suggestion)}`);
    }
    console.log(`  ${theme.primary('│')}`);

    // Dry-run: list and skip
    if (dryRun) {
      console.log(`  ${theme.primary('│')}  ${statusBadge('skip')}  ${theme.muted('[Dry run] Would attempt this repair.')}`);
      console.log(`  ${theme.muted('└─ ○  Dry run — skipped.')}`);
      console.log();
      skipCount++;
      continue;
    }

    // Confirmation
    if (!autoConfirm) {
      const confirmed = await askConfirmation(
        `  ${theme.primary('👉')}  Do you want to attempt this repair? (y/N): `,
      );
      if (!confirmed) {
        console.log(`  ${theme.primary('│')}  ${theme.muted('→ Skipping.')}`);
        console.log(`  ${theme.muted('└─ ○  Skipped.')}`);
        console.log();
        skipCount++;
        continue;
      }
    } else {
      console.log(`  ${theme.primary('│')}  ${theme.muted('(--yes) Auto-confirming repair.')}`);
    }

    console.log(`  ${theme.primary('│')}`);
    const repairSpinner = createSpinner(`Executing repair for ${check.label}...`);
    const repairResult = await repairEngine.runRepair(pluginName, check.name, false);
    repairSpinner.stop();

    if (!repairResult.success) {
      console.log(`  ${theme.primary('│')}  ${statusBadge('fail')}  ${theme.error('Repair execution failed!')}`);
      console.log(`  ${theme.primary('│')}     ${theme.muted(repairResult.message)}`);
      if (repairResult.detail) {
        console.log(`  ${theme.primary('│')}     Detail: ${theme.muted(repairResult.detail)}`);
      }
      console.log(`  ${theme.primary('│')}`);
      console.log(`  ${theme.error('└─ ✖  Repair failed.')}`);
      console.log();
      failCount++;
      continue;
    }

    // Post-repair verification
    console.log(`  ${theme.primary('│')}  ${statusBadge('pass')}  ${repairResult.message}`);
    const verifySpinner = createSpinner('Verifying fix...');
    const verifyResult = await repairEngine.runVerification(pluginName, check.name, false);
    verifySpinner.stop();

    if (verifyResult.success) {
      console.log(`  ${theme.primary('│')}  ${statusBadge('pass')}  ${theme.success('Verification passed. Issue resolved!')}`);
      // ── State transition diff ──────────────────────────────────
      console.log(`  ${theme.primary('│')}`);
      console.log(`  ${theme.primary('│')}  ${theme.muted('State transition:')}`);
      console.log(`  ${theme.primary('│')}    ${theme.muted('Before')}  ${statusBadge(check.status)}  ${theme.error(check.message)}`);
      console.log(`  ${theme.primary('│')}    ${theme.muted('After ')}  ${statusBadge('pass')}  ${theme.success(verifyResult.message)}`);
      if (repairResult.detail) {
        console.log(`  ${theme.primary('│')}    ${theme.muted('Action ')}  ${theme.muted(repairResult.detail)}`);
      }
      console.log(`  ${theme.primary('│')}`);
      // ──────────────────────────────────────────────────────────
      console.log(`  ${theme.primary('└─ ✓  Resolved.')}`);
      successCount++;
    } else {
      console.log(`  ${theme.primary('│')}  ${statusBadge('fail')}  ${theme.error('Verification failed! The issue persists.')}`);
      console.log(`  ${theme.primary('│')}     ${theme.muted(verifyResult.message)}`);

      if (repairResult.rollbackSupported) {
        console.log(`  ${theme.primary('│')}`);
        console.log(`  ${theme.primary('│')}  ${theme.warning('↩  Repair flagged as rollback-supported. Attempting rollback...')}`);
        const rollbackSpinner = createSpinner('Rolling back...');
        const rollbackResult = await repairEngine.runRollback(pluginName, check.name, false);
        rollbackSpinner.stop();

        if (rollbackResult.success) {
          console.log(`  ${theme.primary('│')}  ${statusBadge('warn')}  ${theme.warning('Rolled back successfully. System restored to previous state.')}`);
        } else {
          console.log(`  ${theme.primary('│')}  ${statusBadge('fail')}  ${theme.error('Rollback also failed. Manual intervention may be required.')}`);
          console.log(`  ${theme.primary('│')}     ${theme.muted(rollbackResult.message)}`);
        }
      }

      console.log(`  ${theme.primary('└─ ✖  Repair could not be verified.')}`);
      failCount++;
    }
    console.log();
  }

  // Summary
  console.log(`  ${hr(undefined, 48)}`);
  console.log();

  const elapsedMs = Math.round(performance.now() - startTime);

  if (dryRun) {
    console.log(`  ${theme.primary(`ℹ Dry run complete. ${repairableIssues.length} repair(s) would be attempted. (${elapsedMs}ms)`)}`);
    console.log(`  ${theme.muted('Run without --dry-run to apply them.')}`);
  } else {
    const summaryParts = [
      successCount > 0 ? theme.success(`${successCount} repaired`) : null,
      failCount > 0 ? theme.error(`${failCount} failed`) : null,
      skipCount > 0 ? theme.muted(`${skipCount} skipped`) : null,
    ].filter(Boolean);

    if (summaryParts.length > 0) {
      console.log(`  ${summaryParts.join(theme.muted(' · '))} ${theme.muted('·')} ${theme.muted(`${elapsedMs}ms`)}`);
    } else {
      console.log(`  ${theme.muted('No repairs were attempted.')}`);
    }
  }
  console.log();

  if (failCount > 0) process.exitCode = 1;
  if (dryRun && repairableIssues.length > 0) process.exitCode = 1;
}
