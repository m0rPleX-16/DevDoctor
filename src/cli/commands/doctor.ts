/**
 * Doctor Command
 *
 * The `devdoctor doctor` command — full health dashboard.
 *
 * Supports --format (terminal|json|markdown) and --output <file>.
 *
 * 0.2.2:
 * - Spinner calls .succeed() summarising findings instead of .stop() (item 11)
 * - Recommendations section includes warn checks with suggestions, not just fail (item 4)
 * - Recommendations section label shows count (item 4)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { DiagnosticEngine } from '../../core/engine/diagnostic-engine.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { DetectedTool, HealthStatus, DoctorResult } from '../../core/types/doctor-result.js';
import type { ReportFormat, ResolvedConfig } from '../../core/types/config.js';
import { detectTools } from '../../infra/system/tool-detector.js';
import { showCompactBanner } from '../ui/banner.js';
import { createSpinner } from '../ui/spinner.js';
import { createRenderer, writeReport } from '../reporting/renderer-factory.js';
import {
  theme,
  hr,
  sectionHeader,
  connector,
  statusBadge,
  statusColor,
  progressBar,
} from '../ui/formatter.js';

// ── Health score ──────────────────────────────────────────────────

const TOOL_CATEGORY_LABELS: Record<DetectedTool['category'], string> = {
  runtime: 'Runtimes',
  'package-manager': 'Package Managers',
  'version-control': 'Version Control',
  container: 'Containers',
  'build-tool': 'Build Tools',
  database: 'Databases',
};

function calculateHealthScore(diagnostics: DiagnosticResult[]) {
  let total = 0, passed = 0, warnings = 0, failures = 0;
  for (const r of diagnostics) {
    for (const c of r.checks) {
      total++;
      if (c.status === 'pass') passed++;
      else if (c.status === 'warn') warnings++;
      else if (c.status === 'fail') failures++;
    }
  }
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 100;
  const status: HealthStatus =
    percentage >= 80 ? 'healthy' : percentage >= 50 ? 'degraded' : 'unhealthy';
  return { percentage, status, totalChecks: total, passedChecks: passed, warningChecks: warnings, failedChecks: failures };
}

function healthDisplay(status: HealthStatus) {
  switch (status) {
    case 'healthy':   return { label: 'Healthy',   icon: '💚', colorFn: theme.success };
    case 'degraded':  return { label: 'Degraded',  icon: '💛', colorFn: theme.warning };
    case 'unhealthy': return { label: 'Unhealthy', icon: '❤️',  colorFn: theme.error };
  }
}

// ── Command factory ───────────────────────────────────────────────

interface DoctorOptions {
  format?: ReportFormat;
  output?: string;
}

export function createDoctorCommand(
  engine: DiagnosticEngine,
  config?: ResolvedConfig,
): Command {
  return new Command('doctor')
    .description('Run a full health check across all plugins and tools.')
    .option(
      '-f, --format <format>',
      'Output format: terminal (default), json, markdown',
      config?.defaultFormat ?? 'terminal',
    )
    .option('-o, --output <file>', 'Write report to a file instead of stdout')
    .action(async (options: DoctorOptions) => {
      const format: ReportFormat = options.format ?? config?.defaultFormat ?? 'terminal';

      if (format === 'terminal') showCompactBanner();

      const startTime = performance.now();
      const spinner = format === 'terminal'
        ? createSpinner('Running full health check...')
        : null;

      const [diagnostics, tools] = await Promise.all([
        engine.runAll(),
        detectTools(),
      ]);

      const durationMs = Math.round(performance.now() - startTime);
      const health = calculateHealthScore(diagnostics);

      // Item 11: succeed with a meaningful summary instead of silently stopping
      const issueCount = diagnostics
        .flatMap((d) => d.checks)
        .filter((c) => c.status === 'fail' || c.status === 'warn').length;

      spinner?.succeed(
        issueCount > 0
          ? `Health check complete — ${issueCount} issue(s) found across ${diagnostics.length} plugin(s)`
          : `Health check complete — all ${diagnostics.length} plugin(s) healthy`,
      );

      const doctorResult: DoctorResult = {
        diagnostics,
        tools,
        health,
        timestamp: new Date(),
        durationMs,
      };

      // ── Non-terminal formats ──
      const renderer = createRenderer(format);
      if (renderer) {
        const content = renderer.renderDoctor(doctorResult);
        if (options.output) {
          const filePath = writeReport(content, options.output, config?.reportOutputDir);
          console.log(`  ${theme.success('✓')} Report written to ${chalk.white(filePath)}`);
        } else {
          process.stdout.write(content + '\n');
        }
        return;
      }

      // ── Terminal format ──
      console.log();
      console.log(`  ${hr('Health Dashboard', 48)}`);

      const { label, icon, colorFn } = healthDisplay(health.status);
      console.log();
      console.log(sectionHeader('Health Score', icon));
      console.log(connector());
      console.log(`  ${theme.muted('│')}  ${progressBar(health.percentage, 30, { invert: true })}`);
      console.log(`  ${theme.muted('│')}  ${colorFn(label)} ${theme.muted('·')} ${theme.muted(`${health.totalChecks} checks in ${durationMs}ms`)}`);
      console.log(connector());
      console.log(
        `  ${theme.muted('│')}  ${theme.success(`${health.passedChecks} passed`)}` +
        `  ${theme.muted('·')}  ${theme.warning(`${health.warningChecks} warnings`)}` +
        `  ${theme.muted('·')}  ${theme.error(`${health.failedChecks} failed`)}`,
      );

      if (diagnostics.length > 0) {
        console.log();
        console.log(sectionHeader('Plugin Diagnostics', '🔍'));
        console.log(connector());
        for (const result of diagnostics) {
          const badge = statusBadge(result.overallStatus);
          const name = statusColor(result.displayName, result.overallStatus);
          console.log(
            `  ${theme.muted('│')}  ${badge}  ${name}  ${theme.muted('·')}  ` +
            `${theme.muted(`${result.checks.length} checks`)}  ${theme.muted('·')}  ${theme.muted(`${result.durationMs}ms`)}`,
          );
          if (result.overallStatus !== 'pass') {
            for (const check of result.checks) {
              if (check.status !== 'pass') {
                console.log(
                  `  ${theme.muted('│')}     ${statusBadge(check.status)}  ${theme.muted(check.label)}: ${theme.muted(check.message)}`,
                );
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

      console.log();
      console.log(sectionHeader('Development Tools', '🧰'));
      console.log(connector());
      const installedCount = tools.filter((t) => t.installed).length;
      console.log(`  ${theme.muted('│')}  ${theme.muted(`${installedCount} of ${tools.length} tools detected`)}`);
      console.log(connector());

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
        console.log(`  ${theme.muted('│')}  ${theme.muted(TOOL_CATEGORY_LABELS[category])}`);
        for (const tool of categoryTools) {
          const badge = tool.installed ? statusBadge('pass') : statusBadge('skip');
          const name = tool.installed ? chalk.white(tool.name) : theme.muted(tool.name);
          const version = tool.version ? theme.muted(`v${tool.version}`) : '';
          const notFound = !tool.installed ? theme.muted('not found') : '';
          console.log(`  ${theme.muted('│')}    ${badge}  ${name}  ${version}${notFound}`);
        }
        console.log(connector());
      }

      // Item 4: include warn checks with suggestions, not just fail; show count in label
      const recommendations = diagnostics
        .flatMap((r) => r.checks)
        .filter((c) => (c.status === 'fail' || c.status === 'warn') && c.suggestion);

      if (recommendations.length > 0) {
        console.log();
        console.log(sectionHeader(`Recommendations (${recommendations.length})`, '💡'));
        console.log(connector());
        recommendations.forEach((c, i) => {
          const badge = statusBadge(c.status);
          console.log(`  ${theme.muted('│')}  ${theme.muted(`${i + 1}.`)} ${badge}  ${chalk.hex('#A78BFA')(c.suggestion!)}`);
        });
      }

      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();

      if (options.output) {
        const mdContent = new (await import('../reporting/markdown-renderer.js')).MarkdownRenderer()
          .renderDoctor(doctorResult);
        const filePath = writeReport(mdContent, options.output, config?.reportOutputDir);
        console.log(`  ${theme.muted('Report saved to')} ${chalk.white(filePath)}`);
        console.log();
      }
    });
}
