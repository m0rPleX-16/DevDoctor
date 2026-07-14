/**
 * Rollback Command
 *
 * The `devdoctor rollback [plugin] [check]` command.
 *
 * Without arguments, rolls back all repairs from the last repair session.
 * With arguments, targets a specific plugin/check combination.
 * Only available for checks whose plugin implements `plugin.rollback()`.
 *
 * When to use:
 *   - A repair succeeded mechanically but made things worse
 *   - You applied a fix and want to undo it
 *   - The post-repair verification failed and automatic rollback was skipped
 *     (e.g., because --yes was not set in an automated run)
 *
 * Options:
 *   --yes   Auto-confirm without prompting (for scripted use)
 *
 * ADR-0015: rollback strategy documented.
 */

import { Command } from 'commander';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import type { PluginRegistry } from '../../plugins/plugin-registry.js';
import type { RepairEngine } from '../../core/engine/repair-engine.js';
import { showCompactBanner } from '../ui/banner.js';
import {
  theme,
  hr,
  statusBadge,
} from '../ui/formatter.js';
import { createSpinner } from '../ui/spinner.js';

// ── Confirmation helper ───────────────────────────────────────────

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

interface RollbackOptions {
  yes?: boolean;
}

export function createRollbackCommand(
  registry: PluginRegistry,
  repairEngine: RepairEngine,
): Command {
  return new Command('rollback')
    .description('Roll back the last session of automated repairs, or a specific check.')
    .argument('[plugin]', 'Optional: The plugin name (e.g., mysql)')
    .argument('[check]', 'Optional: The check name to roll back (e.g., mysql-service)')
    .option('-y, --yes', 'Auto-confirm rollback without prompting')
    .addHelpText('after', `
Examples:
  ${chalk.cyan('devdoctor rollback')}                             (Rolls back all repairs from the last session)
  ${chalk.cyan('devdoctor rollback --yes')}                       (Rolls back all repairs, auto-confirmed)
  ${chalk.cyan('devdoctor rollback mysql mysql-service')}         (Rolls back a specific repair)

Note:
  Rollback is only available for checks whose plugin implements rollback support.
  Supported checks: mysql-service, xampp-process, node-permissions, python-venv
`)
    .action(async (pluginName: string | undefined, checkName: string | undefined, options: RollbackOptions) => {
      const autoConfirm = options.yes ?? false;

      showCompactBanner();

      // ── Session Rollback (No arguments) ──
      if (!pluginName || !checkName) {
        if (!autoConfirm && !process.stdin.isTTY) {
          console.log(`\n  ${theme.error('✖ Interactive mode requires a TTY.')}\n  ${theme.muted('Use')} ${chalk.white('--yes')} ${theme.muted('to auto-confirm in non-interactive environments.')}\n`);
          process.exitCode = 1;
          return;
        }

        console.log(`\n  ${hr('Session Rollback', 48)}\n`);
        console.log(`  ${theme.warning('⚠ You are about to roll back all repairs from the last session.')}\n`);

        if (!autoConfirm) {
          const confirmed = await askConfirmation(`  ${theme.primary('👉')}  Proceed with rollback? (y/N): `);
          if (!confirmed) {
            console.log(`\n  ${theme.muted('Rollback cancelled.')}\n`);
            return;
          }
        } else {
          console.log(`  ${theme.muted('(--yes) Auto-confirming rollback.')}`);
        }

        console.log();
        const spinner = createSpinner('Rolling back previous session...');
        const results = await repairEngine.rollbackAll(false);
        spinner.stop();

        if (results.length === 0) {
          console.log(`  ${theme.muted('No rollback snapshot found. Nothing to do.')}\n`);
          return;
        }

        let hasFailures = false;
        for (const result of results) {
          if (result.success) {
            console.log(`  ${statusBadge('pass')}  ${chalk.white(result.checkName)}: ${theme.success('Rollback succeeded.')}`);
          } else {
            hasFailures = true;
            console.log(`  ${statusBadge('fail')}  ${chalk.white(result.checkName)}: ${theme.error('Rollback failed.')}`);
            console.log(`  ${theme.muted('│')}  ${result.message}`);
          }
        }

        if (hasFailures) process.exitCode = 1;
        console.log(`\n  ${hr(undefined, 48)}\n`);
        return;
      }

      // ── Specific Check Rollback (With arguments) ──
      const plugin = registry.get(pluginName);
      if (!plugin) {
        console.log(`\n  ${theme.error(`✖ Unknown plugin: "${pluginName}"`)}\n`);
        process.exitCode = 1;
        return;
      }

      if (!plugin.rollback) {
        console.log(`\n  ${theme.error(`✖ Plugin "${plugin.displayName}" does not support rollback.`)}\n`);
        process.exitCode = 1;
        return;
      }

      if (!autoConfirm && !process.stdin.isTTY) {
        console.log(`\n  ${theme.error('✖ Interactive mode requires a TTY.')}\n`);
        process.exitCode = 1;
        return;
      }

      console.log(`\n  ${hr(`${plugin.displayName} Rollback`, 48)}\n`);
      console.log(`  ${theme.warning('⚠ You are about to roll back a specific repair.')}`);
      console.log(`  ${theme.muted('Plugin:')}  ${chalk.white(plugin.displayName)}`);
      console.log(`  ${theme.muted('Check: ')}  ${chalk.white(checkName)}\n`);

      if (!autoConfirm) {
        const confirmed = await askConfirmation(`  ${theme.primary('👉')}  Proceed with rollback? (y/N): `);
        if (!confirmed) {
          console.log(`\n  ${theme.muted('Rollback cancelled.')}\n`);
          return;
        }
      }

      console.log();
      const spinner = createSpinner(`Rolling back "${checkName}" on ${plugin.displayName}...`);
      const result = await repairEngine.runRollback(pluginName, checkName, false);
      spinner.stop();

      if (result.success) {
        console.log(`  ${statusBadge('pass')}  ${theme.success('Rollback succeeded.')}`);
        console.log(`  ${theme.muted('│')}  ${result.message}`);
      } else {
        console.log(`  ${statusBadge('fail')}  ${theme.error('Rollback failed.')}`);
        console.log(`  ${theme.muted('│')}  ${result.message}`);
        process.exitCode = 1;
      }

      console.log(`\n  ${hr(undefined, 48)}\n`);
    });
}
