/**
 * Diagnose Command
 *
 * The `devdoctor diagnose <plugin>` command.
 *
 * This is the primary command of Dev Doctor. It takes a plugin name,
 * runs all diagnostic checks for that technology, and renders the
 * results in a color-coded, educational format.
 *
 * The output is designed to be scannable (status icons, colors) while
 * also being educational (detailed explanations, suggestions).
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { DiagnosticEngine } from '../../core/engine/diagnostic-engine.js';
import type { DiagnosticCheck } from '../../core/types/diagnostic.js';
import { createSpinner } from '../ui/spinner.js';
import { showCompactBanner } from '../ui/banner.js';
import {
  theme,
  hr,
  statusBadge,
  statusColor,
  statusLine,
  connector,
} from '../ui/formatter.js';

/**
 * Render a single diagnostic check result to the terminal.
 */
function renderCheck(check: DiagnosticCheck, verbose: boolean, isLast: boolean): void {
  const badge = statusBadge(check.status);
  const label = statusColor(check.label, check.status);
  const treeLine = isLast ? theme.muted('└─') : theme.muted('├─');
  const treeIndent = isLast ? '   ' : theme.muted('│') + '  ';

  // Status line: tree connector + icon + label
  console.log(`  ${treeLine} ${badge}  ${label}`);
  console.log(`  ${treeIndent} ${theme.muted(check.message)}`);

  // Show educational detail if verbose or if the check didn't pass
  if (verbose || check.status !== 'pass') {
    if (check.detail) {
      console.log(`  ${treeIndent}`);
      const lines = check.detail.split('\n');
      for (const line of lines) {
        console.log(`  ${treeIndent} ${theme.muted(line)}`);
      }
    }
  }

  // Show suggestion for non-passing checks
  if (check.suggestion && check.status !== 'pass') {
    console.log(`  ${treeIndent}`);
    console.log(`  ${treeIndent} ${chalk.hex('#A78BFA')('💡 ' + check.suggestion)}`);
  }

  if (!isLast) {
    console.log(`  ${theme.muted('│')}`);
  }
}

/**
 * Create the `diagnose` command.
 *
 * @param engine - The diagnostic engine instance
 * @returns The configured Commander command
 */
export function createDiagnoseCommand(engine: DiagnosticEngine): Command {
  return new Command('diagnose')
    .description('Run diagnostic checks for a specific technology.')
    .argument('<plugin>', 'The technology to diagnose (e.g., node, mysql)')
    .option('-v, --verbose', 'Show detailed explanations for all checks, including passing ones')
    .action(async (pluginName: string, options: { verbose?: boolean }) => {
      const verbose = options.verbose ?? false;

      showCompactBanner();

      // Show spinner while running diagnostics
      const spinner = createSpinner(`Running ${pluginName} diagnostics...`);

      const result = await engine.runDiagnostics(pluginName);

      if (!result) {
        spinner.fail(`Unknown plugin: "${pluginName}"`);
        console.log();
        console.log(`  ${theme.muted('Available plugins:')}`);

        const available = engine.getAvailablePlugins();
        for (const name of available) {
          console.log(`    ${theme.primary('›')} ${chalk.white(`devdoctor diagnose ${name}`)}`);
        }

        console.log();
        process.exitCode = 1;
        return;
      }

      spinner.stop();

      // Title bar
      console.log();
      console.log(`  ${hr(result.displayName + ' Diagnostics', 48)}`);
      console.log();

      // Summary stats line
      const statusText =
        result.overallStatus === 'pass'
          ? statusLine('pass', 'All checks passed')
          : result.overallStatus === 'warn'
            ? statusLine('warn', 'Warnings detected')
            : statusLine('fail', 'Issues found');

      console.log(`  ${statusText}  ${theme.muted('·')}  ${theme.muted(`${result.checks.length} checks`)}  ${theme.muted('·')}  ${theme.muted(`${result.durationMs}ms`)}`);
      console.log();

      // Render each check in a tree layout
      for (let i = 0; i < result.checks.length; i++) {
        const isLast = i === result.checks.length - 1;
        renderCheck(result.checks[i], verbose, isLast);
      }

      // Footer
      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();

      const passCount = result.checks.filter((c) => c.status === 'pass').length;
      const warnCount = result.checks.filter((c) => c.status === 'warn').length;
      const failCount = result.checks.filter((c) => c.status === 'fail').length;

      const summary = [
        theme.success(`${passCount} passed`),
        warnCount > 0 ? theme.warning(`${warnCount} warnings`) : null,
        failCount > 0 ? theme.error(`${failCount} failed`) : null,
      ]
        .filter(Boolean)
        .join(theme.muted(' · '));

      console.log(`  ${summary}`);
      console.log();

      if (!verbose && result.checks.some((c) => c.status === 'pass')) {
        console.log(
          `  ${theme.muted('Tip: Use')} ${chalk.white('--verbose')} ${theme.muted('to see detailed explanations for all checks.')}`,
        );
        console.log();
      }

      // Set exit code based on result
      if (result.overallStatus === 'fail') {
        process.exitCode = 1;
      }
    });
}
