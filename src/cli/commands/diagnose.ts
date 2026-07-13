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
import { logger } from '../ui/logger.js';

/**
 * Map a check status to a styled icon for terminal display.
 */
function statusIcon(status: DiagnosticCheck['status']): string {
  switch (status) {
    case 'pass':
      return chalk.green('✓');
    case 'warn':
      return chalk.yellow('⚠');
    case 'fail':
      return chalk.red('✗');
    case 'skip':
      return chalk.dim('○');
  }
}

/**
 * Style the check label based on its status.
 */
function styledLabel(label: string, status: DiagnosticCheck['status']): string {
  switch (status) {
    case 'pass':
      return chalk.green(label);
    case 'warn':
      return chalk.yellow(label);
    case 'fail':
      return chalk.red(label);
    case 'skip':
      return chalk.dim(label);
  }
}

/**
 * Render a single diagnostic check result to the terminal.
 */
function renderCheck(check: DiagnosticCheck, verbose: boolean): void {
  // Status line: icon + label + message
  console.log(`  ${statusIcon(check.status)} ${styledLabel(check.label, check.status)}`);
  logger.detail(check.message);

  // Show educational detail if verbose or if the check didn't pass
  if (verbose || check.status !== 'pass') {
    if (check.detail) {
      logger.newline();
      // Indent detail text for readability
      const lines = check.detail.split('\n');
      for (const line of lines) {
        logger.detail(line);
      }
    }
  }

  // Show suggestion for non-passing checks
  if (check.suggestion && check.status !== 'pass') {
    logger.newline();
    logger.suggestion(check.suggestion);
  }

  logger.newline();
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

      // Show spinner while running diagnostics
      const spinner = createSpinner(`Running ${pluginName} diagnostics...`);

      const result = await engine.runDiagnostics(pluginName);

      if (!result) {
        spinner.fail(`Unknown plugin: "${pluginName}"`);
        logger.newline();
        logger.info('Available plugins:');

        const available = engine.getAvailablePlugins();
        for (const name of available) {
          logger.detail(`devdoctor diagnose ${name}`);
        }

        logger.newline();
        process.exitCode = 1;
        return;
      }

      // Clear spinner and show results
      const statusText =
        result.overallStatus === 'pass'
          ? chalk.green('All checks passed')
          : result.overallStatus === 'warn'
            ? chalk.yellow('Warnings detected')
            : chalk.red('Issues found');

      spinner.stop();

      logger.header(`${result.displayName} Diagnostics`);
      console.log(`  ${chalk.dim('Status:')} ${statusText}`);
      console.log(`  ${chalk.dim('Checks:')} ${result.checks.length}`);
      console.log(`  ${chalk.dim('Duration:')} ${result.durationMs}ms`);
      logger.newline();
      logger.divider();
      logger.newline();

      // Render each check
      for (const check of result.checks) {
        renderCheck(check, verbose);
      }

      // Summary footer
      logger.divider();
      logger.newline();

      const passCount = result.checks.filter((c) => c.status === 'pass').length;
      const warnCount = result.checks.filter((c) => c.status === 'warn').length;
      const failCount = result.checks.filter((c) => c.status === 'fail').length;

      const summary = [
        chalk.green(`${passCount} passed`),
        warnCount > 0 ? chalk.yellow(`${warnCount} warnings`) : null,
        failCount > 0 ? chalk.red(`${failCount} failed`) : null,
      ]
        .filter(Boolean)
        .join(chalk.dim(' · '));

      console.log(`  ${summary}`);
      logger.newline();

      if (!verbose && result.checks.some((c) => c.status === 'pass')) {
        logger.detail(
          'Tip: Use --verbose to see detailed explanations for all checks.',
        );
        logger.newline();
      }

      // Set exit code based on result
      if (result.overallStatus === 'fail') {
        process.exitCode = 1;
      }
    });
}
