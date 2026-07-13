/**
 * Fix Command
 *
 * The `devdoctor fix <plugin>` command.
 *
 * Runs diagnostics, prompts the user interactively before fixing, executes
 * repairs, and performs post-repair verifications to ensure issues are resolved.
 */

import { Command } from 'commander';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import type { DiagnosticEngine } from '../../core/engine/diagnostic-engine.js';
import type { PluginRegistry } from '../../plugins/plugin-registry.js';
import { createSpinner } from '../ui/spinner.js';
import { showCompactBanner } from '../ui/banner.js';
import {
  theme,
  hr,
  statusBadge,
  statusColor,
  statusLine,
} from '../ui/formatter.js';

/**
 * Prompt the user for confirmation via console input.
 */
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

/**
 * Setup and return the CLI Commander command.
 */
export function createFixCommand(
  registry: PluginRegistry,
  engine: DiagnosticEngine,
): Command {
  return new Command('fix')
    .description('Safely repair issues detected by a plugin.')
    .argument('<plugin>', 'The technology plugin to fix (e.g., node, mysql)')
    .action(async (pluginName: string) => {
      showCompactBanner();

      const plugin = registry.get(pluginName);
      if (!plugin) {
        console.log();
        console.log(`  ${theme.error(`✖ Unknown plugin: "${pluginName}"`)}`);
        console.log();
        console.log(`  ${theme.muted('Available plugins:')}`);
        const available = engine.getAvailablePlugins();
        for (const name of available) {
          console.log(`    ${theme.primary('›')} ${chalk.white(`devdoctor fix ${name}`)}`);
        }
        console.log();
        process.exitCode = 1;
        return;
      }

      console.log();
      const diagSpinner = createSpinner(`Diagnosing ${plugin.displayName}...`);
      const result = await engine.runDiagnostics(pluginName);
      diagSpinner.stop();

      if (!result) {
        console.log(`  ${theme.error('✖ Failed to obtain diagnostic results.')}`);
        console.log();
        process.exitCode = 1;
        return;
      }

      const issues = result.checks.filter((c) => c.status === 'fail' || c.status === 'warn');

      // Only offer to repair checks that the plugin explicitly declares support for.
      // Plugins signal this via the optional canRepair(checkName) method.
      // Falls back to filtering by 'fail' status only when canRepair is not implemented,
      // since warnings typically have no safe automated fix.
      const repairableIssues = issues.filter((c) => {
        if (plugin.canRepair) {
          return plugin.canRepair(c.name);
        }
        return c.status === 'fail';
      });

      if (issues.length === 0) {
        console.log(`  ${hr(plugin.displayName + ' Repairs', 48)}`);
        console.log();
        console.log(`  ${statusBadge('pass')}  ${theme.success('No issues found. Your environment is healthy!')}`);
        console.log();
        console.log(`  ${hr(undefined, 48)}`);
        console.log();
        return;
      }

      if (repairableIssues.length === 0) {
        console.log(`  ${hr(plugin.displayName + ' Repairs', 48)}`);
        console.log();
        console.log(`  ${statusBadge('warn')}  ${theme.warning(`Found ${issues.length} warning(s), but none have automated repairs.`)}`);
        console.log();
        for (const check of issues) {
          console.log(`  ${theme.muted('├─')} ${statusBadge('warn')}  ${statusColor(check.label, 'warn')}`);
          console.log(`  ${theme.muted('│')}     ${theme.muted(check.message)}`);
          if (check.suggestion) {
            console.log(`  ${theme.muted('│')}     ${chalk.hex('#A78BFA')('💡 ' + check.suggestion)}`);
          }
          console.log(`  ${theme.muted('│')}`);
        }
        console.log(`  ${hr(undefined, 48)}`);
        console.log();
        return;
      }

      console.log(`  ${hr(plugin.displayName + ' Repairs', 48)}`);
      console.log();
      console.log(`  ${theme.warning(`⚠ Found ${repairableIssues.length} repairable issue(s).`)}`);
      if (issues.length > repairableIssues.length) {
        const warnCount = issues.length - repairableIssues.length;
        console.log(`  ${theme.muted(`  (${warnCount} additional warning(s) have no automated repair — see diagnose output.)`)}`);
      }
      console.log();

      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;

      for (const check of repairableIssues) {
        console.log(`  ${theme.primary('┃')}  ${statusColor(check.label, check.status)}`);
        console.log(`  ${theme.primary('│')}  Current state: ${theme.muted(check.message)}`);
        if (check.suggestion) {
          console.log(`  ${theme.primary('│')}  Proposal: ${chalk.hex('#A78BFA')(check.suggestion)}`);
        }
        console.log(`  ${theme.primary('│')}`);

        const confirmQuery = `  ${theme.primary('👉')}  Do you want to attempt this repair? (y/N): `;
        const confirmed = await askConfirmation(confirmQuery);

        if (!confirmed) {
          console.log(`  ${theme.primary('│')}`);
          console.log(`  ${theme.muted('└─ ○  Skipped repair.')}`);
          console.log();
          skipCount++;
          continue;
        }

        console.log(`  ${theme.primary('│')}`);
        const repairSpinner = createSpinner(`Executing repair for ${check.label}...`);

        let repairResult;
        try {
          repairResult = await plugin.repair(check.name);
        } catch (err) {
          repairResult = {
            checkName: check.name,
            success: false,
            message: `Unexpected error during repair: ${err instanceof Error ? err.message : String(err)}`,
            rollbackSupported: false,
          };
        }

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
        const verifySpinner = createSpinner(`Verifying fix...`);

        let verifyResult;
        try {
          verifyResult = await plugin.verify(check.name);
        } catch (err) {
          verifyResult = {
            checkName: check.name,
            success: false,
            message: `Verification check crashed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        verifySpinner.stop();

        if (verifyResult.success) {
          console.log(`  ${theme.primary('│')}  ${statusBadge('pass')}  ${theme.success('Verification passed. Issue resolved!')}`);
          console.log(`  ${theme.primary('└─ ✓  Resolved.')}`);
          successCount++;
        } else {
          console.log(`  ${theme.primary('│')}  ${statusBadge('fail')}  ${theme.error('Verification failed! The issue persists.')}`);
          console.log(`  ${theme.primary('│')}     ${theme.muted(verifyResult.message)}`);

          // Attempt rollback if the repair indicated it is supported
          if (repairResult.rollbackSupported && plugin.rollback) {
            console.log(`  ${theme.primary('│')}`);
            console.log(`  ${theme.primary('│')}  ${theme.warning('↩  Repair flagged as rollback-supported. Attempting rollback...')}`);
            const rollbackSpinner = createSpinner('Rolling back...');

            let rollbackResult;
            try {
              rollbackResult = await plugin.rollback(check.name);
            } catch (err) {
              rollbackResult = {
                checkName: check.name,
                success: false,
                message: `Rollback crashed: ${err instanceof Error ? err.message : String(err)}`,
                rollbackSupported: false,
              };
            }

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

      const summaryParts = [
        successCount > 0 ? theme.success(`${successCount} repaired`) : null,
        failCount > 0 ? theme.error(`${failCount} failed`) : null,
        skipCount > 0 ? theme.muted(`${skipCount} skipped`) : null,
      ].filter(Boolean);

      if (summaryParts.length === 0) {
        // All items were skipped — shouldn't happen given the loop, but guard it
        console.log(`  ${theme.muted('No repairs were attempted.')}`);
      } else {
        console.log(`  ${summaryParts.join(theme.muted(' · '))}`);
      }
      console.log();

      if (failCount > 0) {
        process.exitCode = 1;
      }
    });
}
