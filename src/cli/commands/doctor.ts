/**
 * Doctor Command
 *
 * The `devdoctor doctor` command — a full health dashboard.
 *
 * Runs ALL registered plugin diagnostics plus a tool detection scan,
 * then presents a summary dashboard with:
 * - Per-plugin status table
 * - Detected tools table
 * - Overall health score
 * - Actionable recommendations
 *
 * This is the "big picture" command — while `diagnose` focuses on
 * one technology, `doctor` gives an overview of everything.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { DiagnosticEngine } from '../../core/engine/diagnostic-engine.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { DetectedTool, HealthStatus } from '../../core/types/doctor-result.js';
import { detectTools } from '../../infra/system/tool-detector.js';
import { showCompactBanner } from '../ui/banner.js';
import { createSpinner } from '../ui/spinner.js';
import {
  theme,
  hr,
  sectionHeader,
  connector,
  statusBadge,
  statusColor,
  progressBar,
} from '../ui/formatter.js';

/** Category display labels */
const TOOL_CATEGORY_LABELS: Record<DetectedTool['category'], string> = {
  runtime: 'Runtimes',
  'package-manager': 'Package Managers',
  'version-control': 'Version Control',
  container: 'Containers',
  'build-tool': 'Build Tools',
  database: 'Databases',
};

/**
 * Calculate a simple health score from diagnostic results.
 * Percentage = passed checks / total checks.
 */
function calculateHealthScore(diagnostics: DiagnosticResult[]) {
  let total = 0;
  let passed = 0;
  let warnings = 0;
  let failures = 0;

  for (const result of diagnostics) {
    for (const check of result.checks) {
      total++;
      if (check.status === 'pass') passed++;
      else if (check.status === 'warn') warnings++;
      else if (check.status === 'fail') failures++;
    }
  }

  const percentage = total > 0 ? Math.round((passed / total) * 100) : 100;
  let status: HealthStatus;
  if (percentage >= 80) status = 'healthy';
  else if (percentage >= 50) status = 'degraded';
  else status = 'unhealthy';

  return { percentage, status, totalChecks: total, passedChecks: passed, warningChecks: warnings, failedChecks: failures };
}

/**
 * Get the display properties for a health status.
 */
function healthDisplay(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return { label: 'Healthy', icon: '💚', colorFn: theme.success };
    case 'degraded':
      return { label: 'Degraded', icon: '💛', colorFn: theme.warning };
    case 'unhealthy':
      return { label: 'Unhealthy', icon: '❤️', colorFn: theme.error };
  }
}

/**
 * Create the `doctor` command.
 */
export function createDoctorCommand(engine: DiagnosticEngine): Command {
  return new Command('doctor')
    .description('Run a full health check across all plugins and tools.')
    .action(async () => {
      showCompactBanner();

      const startTime = performance.now();

      // ── Run diagnostics and tool detection concurrently ──
      const spinner = createSpinner('Running full health check...');

      const [diagnostics, tools] = await Promise.all([
        engine.runAll(),
        detectTools(),
      ]);

      const durationMs = Math.round(performance.now() - startTime);
      const health = calculateHealthScore(diagnostics);

      spinner.stop();

      // ── Title ──
      console.log();
      console.log(`  ${hr('Health Dashboard', 48)}`);

      // ── Health Score ──
      const { label, icon, colorFn } = healthDisplay(health.status);
      console.log();
      console.log(sectionHeader('Health Score', icon));
      console.log(connector());
      console.log(`  ${theme.muted('│')}  ${progressBar(health.percentage)}`);
      console.log(`  ${theme.muted('│')}  ${colorFn(label)} ${theme.muted('·')} ${theme.muted(`${health.totalChecks} checks in ${durationMs}ms`)}`);
      console.log(connector());
      console.log(`  ${theme.muted('│')}  ${theme.success(`${health.passedChecks} passed`)}  ${theme.muted('·')}  ${theme.warning(`${health.warningChecks} warnings`)}  ${theme.muted('·')}  ${theme.error(`${health.failedChecks} failed`)}`);

      // ── Plugin Diagnostics ──
      if (diagnostics.length > 0) {
        console.log();
        console.log(sectionHeader('Plugin Diagnostics', '🔍'));
        console.log(connector());

        for (const result of diagnostics) {
          const badge = statusBadge(result.overallStatus);
          const name = statusColor(result.displayName, result.overallStatus);
          const checkCount = theme.muted(`${result.checks.length} checks`);
          const duration = theme.muted(`${result.durationMs}ms`);

          console.log(`  ${theme.muted('│')}  ${badge}  ${name}  ${theme.muted('·')}  ${checkCount}  ${theme.muted('·')}  ${duration}`);

          // Show individual checks for non-passing plugins
          if (result.overallStatus !== 'pass') {
            for (const check of result.checks) {
              if (check.status !== 'pass') {
                const checkBadge = statusBadge(check.status);
                console.log(`  ${theme.muted('│')}     ${checkBadge}  ${theme.muted(check.label)}: ${theme.muted(check.message)}`);
              }
            }
          }
        }
      } else {
        console.log();
        console.log(sectionHeader('Plugin Diagnostics', '🔍'));
        console.log(connector());
        console.log(`  ${theme.muted('│')}  ${theme.muted('No plugins registered.')}`);
      }

      // ── Detected Tools ──
      console.log();
      console.log(sectionHeader('Development Tools', '🧰'));
      console.log(connector());

      const installedCount = tools.filter((t) => t.installed).length;
      console.log(`  ${theme.muted('│')}  ${theme.muted(`${installedCount} of ${tools.length} tools detected`)}`);
      console.log(connector());

      // Group tools by category
      const toolsByCategory = new Map<DetectedTool['category'], DetectedTool[]>();
      for (const tool of tools) {
        const list = toolsByCategory.get(tool.category) ?? [];
        list.push(tool);
        toolsByCategory.set(tool.category, list);
      }

      const categoryOrder: DetectedTool['category'][] = [
        'runtime', 'package-manager', 'version-control', 'container', 'build-tool', 'database',
      ];

      for (const category of categoryOrder) {
        const categoryTools = toolsByCategory.get(category);
        if (!categoryTools) continue;

        const categoryLabel = TOOL_CATEGORY_LABELS[category];
        console.log(`  ${theme.muted('│')}  ${theme.muted(categoryLabel)}`);

        for (const tool of categoryTools) {
          const badge = tool.installed ? statusBadge('pass') : statusBadge('skip');
          const name = tool.installed ? chalk.white(tool.name) : theme.muted(tool.name);
          const version = tool.version ? theme.muted(`v${tool.version}`) : '';
          const notFound = !tool.installed ? theme.muted('not found') : '';

          console.log(`  ${theme.muted('│')}    ${badge}  ${name}  ${version}${notFound}`);
        }

        console.log(connector());
      }

      // ── Recommendations ──
      const issues: string[] = [];

      for (const result of diagnostics) {
        for (const check of result.checks) {
          if (check.status === 'fail' && check.suggestion) {
            issues.push(check.suggestion);
          }
        }
      }

      if (issues.length > 0) {
        console.log();
        console.log(sectionHeader('Recommendations', '💡'));
        console.log(connector());

        for (let i = 0; i < issues.length; i++) {
          const num = theme.muted(`${i + 1}.`);
          console.log(`  ${theme.muted('│')}  ${num} ${chalk.hex('#A78BFA')(issues[i])}`);
        }
      }

      // ── Footer ──
      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();
    });
}
