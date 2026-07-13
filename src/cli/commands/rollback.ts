/**
 * Rollback Command
 *
 * The `devdoctor rollback <plugin> <check>` command.
 *
 * Attempts to roll back the last repair performed on a specific check.
 * Only checks whose plugin implements `plugin.rollback()` support this.
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
    .description('Roll back the last automated repair for a specific check.')
    .argument('<plugin>', 'The plugin name (e.g., mysql)')
    .argument('<check>', 'The check name to roll back (e.g., mysql-service)')
    .option('-y, --yes', 'Auto-confirm rollback without prompting')
    .addHelpText('after', `
Examples:
  ${chalk.cyan('devdoctor rollback mysql mysql-service')}
  ${chalk.cyan('devdoctor rollback mysql xampp-process --yes')}
  ${chalk.cyan('devdoctor rollback node node-permissions')}
  ${chalk.cyan('devdoctor rollback python python-venv')}

Note:
  Rollback is only available for checks whose plugin implements rollback support.
  Supported checks: mysql-service, xampp-process, node-permissions, python-venv
  Use ${chalk.white('devdoctor fix <plugin> --dry-run')} first to preview the repair state.
`)
    .action(async (pluginName: string, checkName: string, options: RollbackOptions) => {
      const autoConfirm = options.yes ?? false;

      showCompactBanner();

      // ── Validate plugin exists ──
      const plugin = registry.get(pluginName);
      if (!plugin) {
        console.log();
        console.log(`  ${theme.error(`✖ Unknown plugin: "${pluginName}"`)}`);
        console.log();
        console.log(`  ${theme.muted('Available plugins:')}`);
        for (const p of registry.list()) {
          console.log(`    ${theme.primary('›')} ${chalk.white(p.name)}`);
        }
        console.log();
        console.log(`  ${theme.muted('Run')} ${chalk.white('devdoctor --help')} ${theme.muted('to see all available commands.')}`);
        console.log();
        process.exitCode = 1;
        return;
      }

      // ── Validate rollback is implemented ──
      if (!plugin.rollback) {
        console.log();
        console.log(
          `  ${theme.error(`✖ Plugin "${plugin.displayName}" does not support rollback.`)}`,
        );
        console.log();
        console.log(
          `  ${theme.muted('Only plugins that implement')} ${chalk.white('rollback()')} ` +
          `${theme.muted('support this command.')}`,
        );
        console.log(
          `  ${theme.muted('Currently supported:')}`,
        );
        console.log(`    ${theme.primary('›')} ${chalk.white('mysql')}  ${theme.muted('— mysql-service, xampp-process')}`);
        console.log(`    ${theme.primary('›')} ${chalk.white('node')}   ${theme.muted('— node-permissions')}`);
        console.log(`    ${theme.primary('›')} ${chalk.white('python')} ${theme.muted('— python-venv')}`);
        console.log();
        process.exitCode = 1;
        return;
      }

      // ── TTY guard ──
      if (!autoConfirm && !process.stdin.isTTY) {
        console.log();
        console.log(`  ${theme.error('✖ Interactive mode requires a TTY.')}`);
        console.log(
          `  ${theme.muted('Use')} ${chalk.white('--yes')} ` +
          `${theme.muted('to auto-confirm in non-interactive environments.')}`,
        );
        console.log();
        process.exitCode = 1;
        return;
      }

      console.log();
      console.log(`  ${hr(`${plugin.displayName} Rollback`, 48)}`);
      console.log();
      console.log(`  ${theme.warning('⚠ You are about to roll back a repair.')}`);
      console.log(`  ${theme.muted('Plugin:')}  ${chalk.white(plugin.displayName)}`);
      console.log(`  ${theme.muted('Check: ')}  ${chalk.white(checkName)}`);
      console.log();
      console.log(
        `  ${theme.muted('This will attempt to undo the repair for')} ` +
        `${chalk.white(`"${checkName}"`)}${theme.muted('.')}`,
      );
      console.log(
        `  ${theme.muted('The exact action depends on what the repair did (e.g., stopping a service it started).')}`,
      );
      console.log();

      // ── Confirmation ──
      if (!autoConfirm) {
        const confirmed = await askConfirmation(
          `  ${theme.primary('👉')}  Proceed with rollback? (y/N): `,
        );
        if (!confirmed) {
          console.log();
          console.log(`  ${theme.muted('Rollback cancelled.')}`);
          console.log();
          return;
        }
      } else {
        console.log(`  ${theme.muted('(--yes) Auto-confirming rollback.')}`);
      }

      console.log();

      // ── Execute rollback ──
      const spinner = createSpinner(`Rolling back "${checkName}" on ${plugin.displayName}...`);
      const result = await repairEngine.runRollback(pluginName, checkName, false);
      spinner.stop();

      if (result.success) {
        console.log(
          `  ${statusBadge('pass')}  ${theme.success('Rollback succeeded.')}`,
        );
        console.log(`  ${theme.muted('│')}  ${result.message}`);
        if (result.detail) {
          console.log(`  ${theme.muted('│')}  ${theme.muted(result.detail)}`);
        }
      } else {
        console.log(
          `  ${statusBadge('fail')}  ${theme.error('Rollback failed.')}`,
        );
        console.log(`  ${theme.muted('│')}  ${result.message}`);
        if (result.detail) {
          console.log(`  ${theme.muted('│')}  ${theme.muted(result.detail)}`);
        }
        console.log();
        console.log(
          `  ${theme.muted('Manual intervention may be required. ' +
          'Check the service or process state directly.')}`,
        );
        process.exitCode = 1;
      }

      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();

      // Post-rollback: suggest re-diagnosing to confirm the environment state
      console.log(
        `  ${theme.muted('Run')} ${chalk.white(`devdoctor diagnose ${pluginName}`)} ` +
        `${theme.muted('to confirm the current environment state.')}`,
      );
      console.log();
    });
}
