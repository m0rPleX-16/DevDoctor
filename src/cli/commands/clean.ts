/**
 * Clean Command
 *
 * `devdoctor clean snapshot` — delete the repair session snapshot
 * `devdoctor clean history`  — clear the doctor run history (runs.json)
 * `devdoctor clean audit`    — clear the repair audit log (history.json)
 * `devdoctor clean lock`     — remove a stale fix.lock file
 * `devdoctor clean all`      — wipe all of the above
 *
 * Why this matters:
 * Dev Doctor accumulates state across sessions in ~/.devdoctor/. Without a
 * way to clear it, users have no escape hatch when:
 *   - A snapshot from a crashed fix run prevents `rollback` from working cleanly
 *   - A stale lockfile blocks all future `fix` runs
 *   - They want to reset trending data before sharing a health report
 *
 * Every subcommand requires confirmation unless --yes is passed, consistent
 * with `fix` and `rollback`.
 *
 * ADR-0020: Clean command design documented.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Command } from 'commander';
import chalk from 'chalk';
import { showCompactBanner } from '../ui/banner.js';
import { theme, hr } from '../ui/formatter.js';

// ── Paths ─────────────────────────────────────────────────────────

const DEVDOCTOR_DIR = path.join(os.homedir(), '.devdoctor');
const SNAPSHOT_FILE = path.join(DEVDOCTOR_DIR, 'snapshots', 'latest.json');
const HISTORY_FILE = path.join(DEVDOCTOR_DIR, 'runs.json');
const AUDIT_FILE = path.join(DEVDOCTOR_DIR, 'history.json');
const LOCK_FILE = path.join(DEVDOCTOR_DIR, 'fix.lock');

// ── Helpers ───────────────────────────────────────────────────────

async function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(query);
    return answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes';
  } finally {
    rl.close();
  }
}

interface CleanTarget {
  /** Short label shown in output */
  label: string;
  /** Full path to the file to remove */
  filePath: string;
  /** Shown when the file exists and the user is about to delete it */
  warning?: string;
}

function deleteFile(filePath: string): 'deleted' | 'not_found' | 'error' {
  if (!fs.existsSync(filePath)) return 'not_found';
  try {
    fs.unlinkSync(filePath);
    return 'deleted';
  } catch {
    return 'error';
  }
}

/**
 * Run clean for one or more targets.
 * Returns true if at least one file was deleted.
 */
async function runClean(
  targets: CleanTarget[],
  autoConfirm: boolean,
  scopeLabel: string,
): Promise<boolean> {
  showCompactBanner();

  console.log(`\n  ${hr(`Clean — ${scopeLabel}`, 48)}\n`);

  // Show what exists
  const existing = targets.filter((t) => fs.existsSync(t.filePath));
  const absent = targets.filter((t) => !fs.existsSync(t.filePath));

  if (existing.length === 0) {
    console.log(`  ${theme.muted('Nothing to clean. All targets are already absent.')}\n`);
    for (const t of absent) {
      console.log(`  ${theme.muted('○')}  ${theme.muted(t.label)}  ${theme.muted('(not found)')}`);
    }
    console.log();
    return false;
  }

  console.log(`  ${theme.warning(`⚠ The following file(s) will be permanently deleted:`)}\n`);
  for (const t of existing) {
    console.log(`  ${chalk.white('•')}  ${chalk.white(t.label)}`);
    console.log(`     ${theme.muted(t.filePath)}`);
    if (t.warning) {
      console.log(`     ${theme.warning(`⚠ ${t.warning}`)}`);
    }
  }
  if (absent.length > 0) {
    console.log();
    for (const t of absent) {
      console.log(
        `  ${theme.muted('○')}  ${theme.muted(t.label)}  ${theme.muted('(not found — will be skipped)')}`,
      );
    }
  }
  console.log();

  if (!autoConfirm) {
    if (!process.stdin.isTTY) {
      console.log(`  ${theme.error('✖ Interactive mode requires a TTY.')}`);
      console.log(
        `  ${theme.muted('Use')} ${chalk.white('--yes')} ${theme.muted('to confirm in non-interactive environments.')}\n`,
      );
      process.exitCode = 1;
      return false;
    }
    const confirmed = await askConfirmation(`  ${theme.primary('›')}  Proceed? (y/N): `);
    if (!confirmed) {
      console.log(`\n  ${theme.muted('Cancelled. Nothing was deleted.')}\n`);
      return false;
    }
  } else {
    console.log(`  ${theme.muted('(--yes) Auto-confirming.')}`);
  }

  console.log();

  let anyDeleted = false;
  for (const t of existing) {
    const result = deleteFile(t.filePath);
    if (result === 'deleted') {
      console.log(`  ${theme.success('✓')}  ${chalk.white(t.label)} ${theme.muted('deleted.')}`);
      anyDeleted = true;
    } else {
      console.log(
        `  ${theme.error('✖')}  ${chalk.white(t.label)} ${theme.error('could not be deleted.')}`,
      );
      process.exitCode = 1;
    }
  }

  console.log(`\n  ${hr(undefined, 48)}\n`);
  return anyDeleted;
}

// ── Target definitions ────────────────────────────────────────────

function snapshotTarget(): CleanTarget {
  return {
    label: 'Repair session snapshot',
    filePath: SNAPSHOT_FILE,
    warning:
      'Deleting this makes any pending repairs permanent — ' +
      '`devdoctor rollback` (no args) will have nothing to undo.',
  };
}

function historyTarget(): CleanTarget {
  return {
    label: 'Doctor run history (runs.json)',
    filePath: HISTORY_FILE,
  };
}

function auditTarget(): CleanTarget {
  return {
    label: 'Repair audit log (history.json)',
    filePath: AUDIT_FILE,
  };
}

function lockTarget(): CleanTarget {
  return {
    label: 'Fix lockfile (fix.lock)',
    filePath: LOCK_FILE,
  };
}

// ── Command factory ───────────────────────────────────────────────

interface CleanOptions {
  yes?: boolean;
}

export function createCleanCommand(): Command {
  const clean = new Command('clean')
    .description('Remove Dev Doctor state files from ~/.devdoctor/.')
    .addHelpText(
      'after',
      `
Subcommands:
  ${chalk.cyan('devdoctor clean snapshot')}   Delete the repair session snapshot (used by rollback)
  ${chalk.cyan('devdoctor clean history')}    Clear the doctor run history (runs.json)
  ${chalk.cyan('devdoctor clean audit')}      Clear the repair audit log (history.json)
  ${chalk.cyan('devdoctor clean lock')}       Remove a stale fix.lock file
  ${chalk.cyan('devdoctor clean all')}        Wipe all of the above

Options:
  -y, --yes   Auto-confirm without prompting (for scripted environments)
`,
    );

  // ── clean snapshot ──
  clean
    .command('snapshot')
    .description('Delete the repair session snapshot used by `devdoctor rollback`.')
    .option('-y, --yes', 'Auto-confirm without prompting')
    .action(async (options: CleanOptions) => {
      await runClean([snapshotTarget()], options.yes ?? false, 'Snapshot');
    });

  // ── clean history ──
  clean
    .command('history')
    .description('Clear the doctor run history (health score timeline).')
    .option('-y, --yes', 'Auto-confirm without prompting')
    .action(async (options: CleanOptions) => {
      await runClean([historyTarget()], options.yes ?? false, 'Run History');
    });

  // ── clean audit ──
  clean
    .command('audit')
    .description('Clear the repair audit log.')
    .option('-y, --yes', 'Auto-confirm without prompting')
    .action(async (options: CleanOptions) => {
      await runClean([auditTarget()], options.yes ?? false, 'Audit Log');
    });

  // ── clean lock ──
  clean
    .command('lock')
    .description('Remove a stale fix.lock file that is blocking `devdoctor fix`.')
    .option('-y, --yes', 'Auto-confirm without prompting')
    .action(async (options: CleanOptions) => {
      await runClean([lockTarget()], options.yes ?? false, 'Lock File');
    });

  // ── clean all ──
  clean
    .command('all')
    .description('Remove all Dev Doctor state files.')
    .option('-y, --yes', 'Auto-confirm without prompting')
    .action(async (options: CleanOptions) => {
      await runClean(
        [snapshotTarget(), historyTarget(), auditTarget(), lockTarget()],
        options.yes ?? false,
        'All State',
      );
    });

  return clean;
}
