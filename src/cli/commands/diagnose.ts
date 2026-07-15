/**
 * Diagnose Command
 *
 * The `devdoctor diagnose <plugin>` command.
 *
 * Supports three output formats via --format:
 *   terminal (default) — colour-coded tree output
 *   json               — machine-readable JSON to stdout or file
 *   markdown           — GitHub-Flavoured Markdown report
 *
 * Use --output <file> to write the report to disk instead of stdout.
 *
 * 0.2.2:
 * - Spinner calls .succeed() with check count instead of silently stopping (item 9)
 * - Spinner calls .stop() (not .fail()) before error blocks to avoid visual competition (item 1)
 * - "Use --verbose" tip is conditional on checks that have suppressed detail (item 2)
 * - Error paths end with a "run --help" hint (item 8)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { DiagnosticEngine } from '../../core/engine/diagnostic-engine.js';
import type { DiagnosticCheck } from '../../core/types/diagnostic.js';
import type { ReportFormat } from '../../core/types/config.js';
import type { ResolvedConfig } from '../../core/types/config.js';
import { createRenderer, writeReport } from '../reporting/renderer-factory.js';
import { createSpinner } from '../ui/spinner.js';
import { showCompactBanner } from '../ui/banner.js';
import { theme, hr, statusBadge, statusColor, statusLine } from '../ui/formatter.js';

// ── Terminal rendering ────────────────────────────────────────────

function renderCheck(check: DiagnosticCheck, verbose: boolean, isLast: boolean): void {
  const badge = statusBadge(check.status);
  const label = statusColor(check.label, check.status);
  const treeLine = isLast ? theme.muted('└─') : theme.muted('├─');
  const treeIndent = isLast ? '   ' : theme.muted('│') + '  ';

  console.log(`  ${treeLine} ${badge}  ${label}`);
  console.log(`  ${treeIndent} ${theme.muted(check.message)}`);
  // #6: when a check was skipped due to a dependency, show a dim cascade indicator
  if (check.status === 'skip' && check.message.toLowerCase().includes('depends on')) {
    console.log(`  ${treeIndent} ${theme.muted('↳ blocked by a failed upstream check')}`);
  }

  if (verbose || check.status !== 'pass') {
    if (check.detail) {
      console.log(`  ${treeIndent}`);
      for (const line of check.detail.split('\n')) {
        console.log(`  ${treeIndent} ${theme.muted(line)}`);
      }
    }
  }

  if (check.suggestion && check.status !== 'pass') {
    console.log(`  ${treeIndent}`);
    const suggLines = ('✦ ' + check.suggestion).split('\n');
    console.log(`  ${treeIndent} ${chalk.hex('#A78BFA')(suggLines[0])}`);
    for (let i = 1; i < suggLines.length; i++) {
      console.log(`  ${treeIndent} ${chalk.hex('#A78BFA')(suggLines[i])}`);
    }
  }

  if (!isLast) {
    console.log(`  ${theme.muted('│')}`);
  }
}

// ── Command factory ───────────────────────────────────────────────

interface DiagnoseOptions {
  verbose?: boolean;
  format?: ReportFormat;
  output?: string;
}

export function createDiagnoseCommand(engine: DiagnosticEngine, config?: ResolvedConfig): Command {
  return new Command('diagnose')
    .description('Run diagnostic checks for a specific technology.')
    .argument('<plugin>', 'The technology to diagnose (e.g., node, mysql)')
    .option('-v, --verbose', 'Show detailed explanations for all checks, including passing ones')
    .option(
      '-f, --format <format>',
      'Output format: terminal (default), json, markdown',
      config?.defaultFormat ?? 'terminal',
    )
    .option('-o, --output <file>', 'Write report to a file instead of stdout')
    .action(async (pluginName: string, options: DiagnoseOptions) => {
      const verbose = options.verbose ?? false;
      const format: ReportFormat = options.format ?? config?.defaultFormat ?? 'terminal';

      if (format === 'terminal') showCompactBanner();

      const spinner =
        format === 'terminal' ? createSpinner(`Running ${pluginName} diagnostics...`) : null;

      const result = await engine.runDiagnostics(pluginName);

      if (!result) {
        // Item 1: stop silently — let the error block below be the sole message
        spinner?.stop();

        if (format !== 'terminal') {
          process.stderr.write(`Error: Unknown plugin "${pluginName}"\n`);
        } else {
          console.log();
          console.log(`  ${theme.error(`✖ Unknown plugin: "${pluginName}"`)}`);
          console.log();
          console.log(`  ${theme.muted('Available plugins:')}`);
          for (const name of engine.getAvailablePlugins()) {
            console.log(`    ${theme.primary('›')} ${chalk.white(`devdoctor diagnose ${name}`)}`);
          }
          console.log();
          // Item 8: what to do next
          console.log(
            `  ${theme.muted('Run')} ${chalk.white('devdoctor --help')} ${theme.muted('to see all available commands and options.')}`,
          );
          console.log();
        }
        process.exitCode = 1;
        return;
      }

      // Item 9: succeed with check count instead of silently stopping
      if (format === 'terminal') {
        spinner?.succeed(`${result.checks.length} checks completed in ${result.durationMs}ms`);
      }

      // ── Non-terminal formats ──
      const renderer = createRenderer(format);
      if (renderer) {
        const content = renderer.renderDiagnostic(result);

        if (options.output) {
          const filePath = writeReport(content, options.output, config?.reportOutputDir);
          console.log(`  ${theme.success('✓')} Report written to ${chalk.white(filePath)}`);
        } else {
          process.stdout.write(content + '\n');
        }

        if (result.overallStatus === 'fail') process.exitCode = 1;
        return;
      }

      // ── Terminal format ──
      console.log();
      console.log(`  ${hr(result.displayName + ' Diagnostics', 48)}`);
      console.log();

      const statusText =
        result.overallStatus === 'pass'
          ? statusLine('pass', 'All checks passed')
          : result.overallStatus === 'skip'
            ? statusLine('skip', 'Checks completed')
            : result.overallStatus === 'warn'
              ? statusLine('warn', 'Warnings detected')
              : statusLine('fail', 'Issues found');

      console.log(
        `  ${statusText}  ${theme.muted('·')}  ${theme.muted(`${result.checks.length} checks`)}  ${theme.muted('·')}  ${theme.muted(`${result.durationMs}ms`)}`,
      );
      console.log();

      for (let i = 0; i < result.checks.length; i++) {
        renderCheck(result.checks[i], verbose, i === result.checks.length - 1);
      }

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

      // Item 2: only show the --verbose tip when there's suppressed detail to reveal
      const hasHiddenDetail =
        !verbose &&
        result.checks.some((c) => c.status === 'pass' && c.detail && c.detail.trim().length > 0);
      if (hasHiddenDetail) {
        console.log(
          `  ${theme.muted('Tip: Use')} ${chalk.white('--verbose')} ${theme.muted('to see detailed explanations for all checks.')}`,
        );
        console.log();
      }

      if (options.output) {
        const mdContent = new (
          await import('../reporting/markdown-renderer.js')
        ).MarkdownRenderer().renderDiagnostic(result);
        const filePath = writeReport(mdContent, options.output, config?.reportOutputDir);
        console.log(`  ${theme.muted('Report saved to')} ${chalk.white(filePath)}`);
        console.log();
      }

      if (result.overallStatus === 'fail') process.exitCode = 1;
    });
}
