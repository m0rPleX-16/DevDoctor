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
import type { IHistoryStore } from '../../infra/audit/history-store.js';
import { detectTools } from '../../infra/system/tool-detector.js';
import { detectProjectContext } from '../../infra/system/project-detector.js';
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
  let total = 0,
    passed = 0,
    warnings = 0,
    failures = 0;
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
  return {
    percentage,
    status,
    totalChecks: total,
    passedChecks: passed,
    warningChecks: warnings,
    failedChecks: failures,
  };
}

function healthDisplay(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return { label: 'Healthy', icon: theme.success('●'), colorFn: theme.success };
    case 'degraded':
      return { label: 'Degraded', icon: theme.warning('▲'), colorFn: theme.warning };
    case 'unhealthy':
      return { label: 'Unhealthy', icon: theme.error('✖'), colorFn: theme.error };
  }
}

// ── Command factory ───────────────────────────────────────────────

interface DoctorOptions {
  format?: ReportFormat;
  output?: string;
  all?: boolean;
}

export function createDoctorCommand(
  engine: DiagnosticEngine,
  config?: ResolvedConfig,
  historyStore?: IHistoryStore,
  registry?: import('../../core/plugin-registry.js').PluginRegistry,
): Command {
  return new Command('doctor')
    .description('Run a full health check across all plugins and tools.')
    .option(
      '-a, --all',
      'Run diagnostics for all plugins, ignoring project directory detection context',
    )
    .option(
      '-f, --format <format>',
      'Output format: terminal (default), json, markdown',
      config?.defaultFormat ?? 'terminal',
    )
    .option('-o, --output <file>', 'Write report to a file instead of stdout')
    .action(async (options: DoctorOptions) => {
      const format: ReportFormat = options.format ?? config?.defaultFormat ?? 'terminal';
      const runAllPlugins = options.all ?? false;

      if (format === 'terminal') showCompactBanner();

      const startTime = performance.now();
      const spinner = format === 'terminal' ? createSpinner('Running full health check...') : null;

      const allPlugins = registry?.list() ?? [];
      const projectCtx =
        allPlugins.length > 0
          ? detectProjectContext(allPlugins)
          : { detectedPlugins: new Set<string>(), matchedMarkers: {} };

      const hasAnyDetected = projectCtx.detectedPlugins.size > 0;

      // Smart filter: only run detected plugins unless --all is passed, or no plugins are detected
      const pluginsToRun =
        runAllPlugins || !hasAnyDetected ? undefined : Array.from(projectCtx.detectedPlugins);

      const [diagnostics, tools] = await Promise.all([engine.runAll(pluginsToRun), detectTools()]);

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

      // Persist a lightweight history entry for `devdoctor history` trending
      if (historyStore) {
        const pluginSummary: Record<string, 'pass' | 'warn' | 'fail' | 'skip'> = {};
        for (const d of diagnostics) {
          pluginSummary[d.pluginName] = d.overallStatus;
        }
        historyStore.append({
          timestamp: new Date().toISOString(),
          percentage: health.percentage,
          status: health.status,
          totalChecks: health.totalChecks,
          passedChecks: health.passedChecks,
          warningChecks: health.warningChecks,
          failedChecks: health.failedChecks,
          durationMs,
          pluginSummary,
        });
      }

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

      // Large percentage readout
      const pctStr = `${health.percentage}%`;
      console.log(
        `  ${theme.muted('│')}  ${colorFn.bold(pctStr)} ${theme.muted('overall health')}`,
      );
      console.log(`  ${theme.muted('│')}  ${progressBar(health.percentage, 30, { invert: true })}`);
      console.log(
        `  ${theme.muted('│')}  ${colorFn(label)} ${theme.muted('·')} ${theme.muted(`${health.totalChecks} checks`)} ${theme.muted('·')} ${theme.muted(`${durationMs}ms`)}`,
      );
      console.log(connector());

      // Tally row with aligned columns
      console.log(
        `  ${theme.muted('│')}  ${theme.success('●')} ${theme.success(`${health.passedChecks} passed`)}` +
          `   ${theme.warning('▲')} ${theme.warning(`${health.warningChecks} warnings`)}` +
          `   ${theme.error('✖')} ${theme.error(`${health.failedChecks} failed`)}`,
      );

      if (diagnostics.length > 0) {
        console.log();
        console.log(sectionHeader('Plugin Diagnostics', theme.primary('⌕')));
        console.log(connector());

        // ── Project-context grouping ──────────────────────────────
        const allPlugins = registry?.list() ?? [];
        const projectCtx =
          allPlugins.length > 0
            ? detectProjectContext(allPlugins)
            : { detectedPlugins: new Set<string>(), matchedMarkers: {} };

        const hasAnyDetected = projectCtx.detectedPlugins.size > 0;

        const detected = diagnostics.filter((r) => projectCtx.detectedPlugins.has(r.pluginName));
        const others = diagnostics.filter((r) => !projectCtx.detectedPlugins.has(r.pluginName));

        const CATEGORY_ICONS: Record<string, string> = {
          language: chalk.hex('#36BCF7')('◆'),
          framework: chalk.hex('#A78BFA')('◆'),
          database: chalk.hex('#22C55E')('◆'),
          tool: chalk.hex('#6B7280')('◆'),
        };

        const renderPluginResult = (result: DiagnosticResult, isDetected: boolean) => {
          const badge = statusBadge(result.overallStatus);
          const name = statusColor(result.displayName, result.overallStatus);
          const relevanceTag = hasAnyDetected
            ? isDetected
              ? chalk.hex('#86efac')(' · detected')
              : theme.muted(' · not in project')
            : '';
          const markers =
            isDetected && projectCtx.matchedMarkers[result.pluginName]
              ? theme.muted(` (${projectCtx.matchedMarkers[result.pluginName].join(', ')})`)
              : '';
          console.log(
            `  ${theme.muted('│')}    ${badge}  ${name}${relevanceTag}${markers}  ` +
              `${theme.muted('·')}  ${theme.muted(`${result.checks.length} checks`)}  ` +
              `${theme.muted('·')}  ${theme.muted(`${result.durationMs}ms`)}`,
          );
          if (result.overallStatus !== 'pass') {
            for (const check of result.checks) {
              const showInline = isDetected
                ? check.status !== 'pass'
                : check.status === 'fail' || check.status === 'warn';
              if (showInline) {
                console.log(
                  `  ${theme.muted('│')}       ${statusBadge(check.status)}  ` +
                    `${theme.muted(check.label)}${theme.muted(':')} ${theme.muted(check.message)}`,
                );
              }
            }
          }
        };

        const renderGroup = (results: DiagnosticResult[], isDetected: boolean) => {
          const categoriesOrder = ['language', 'framework', 'database', 'tool'];
          const categoryLabels: Record<string, string> = {
            language: 'Languages',
            framework: 'Frameworks',
            database: 'Databases',
            tool: 'Tools & Utilities',
          };

          const grouped = new Map<string, DiagnosticResult[]>();
          for (const r of results) {
            const p = registry?.get(r.pluginName);
            const cat = p?.category ?? 'tool';
            const list = grouped.get(cat) ?? [];
            list.push(r);
            grouped.set(cat, list);
          }

          let firstCat = true;
          for (const cat of categoriesOrder) {
            const catResults = grouped.get(cat);
            if (!catResults || catResults.length === 0) continue;

            if (!firstCat) {
              console.log(`  ${theme.muted('│')}`);
            }
            firstCat = false;

            const catIcon = CATEGORY_ICONS[cat] ?? theme.muted('◆');
            console.log(`  ${theme.muted('│')}  ${catIcon} ${chalk.bold(categoryLabels[cat])}`);
            for (const result of catResults) {
              renderPluginResult(result, isDetected);
            }
          }
        };

        if (hasAnyDetected && detected.length > 0) {
          console.log(
            `  ${theme.muted('│')}  ${chalk.hex('#86efac').bold('▸ Detected in this project')}`,
          );
          renderGroup(detected, true);
          if (others.length > 0) {
            console.log(`  ${theme.muted('│')}`);
            console.log(`  ${theme.muted('│')}  ${theme.muted('▸ Other plugins')}`);
            renderGroup(others, false);
          }
        } else {
          renderGroup(diagnostics, false);
        }
      } else {
        console.log();
        console.log(sectionHeader('Plugin Diagnostics', theme.primary('⌕')));
        console.log(connector());
        console.log(`  ${theme.muted('│')}  ${theme.muted('No plugins registered.')}`);
      }

      console.log();
      console.log(sectionHeader('Development Tools', theme.accent('⚒')));
      console.log(connector());
      const installedCount = tools.filter((t) => t.installed).length;
      console.log(
        `  ${theme.muted('│')}  ${theme.text(`${installedCount}`)}${theme.muted('/')}${theme.text(`${tools.length}`)} ${theme.muted('tools detected')}`,
      );
      console.log(connector());

      const toolsByCategory = new Map<DetectedTool['category'], DetectedTool[]>();
      for (const tool of tools) {
        const list = toolsByCategory.get(tool.category) ?? [];
        list.push(tool);
        toolsByCategory.set(tool.category, list);
      }

      const categoryOrder: DetectedTool['category'][] = [
        'runtime',
        'package-manager',
        'version-control',
        'container',
        'build-tool',
        'database',
      ];

      for (const category of categoryOrder) {
        const categoryTools = toolsByCategory.get(category);
        if (!categoryTools) continue;
        console.log(`  ${theme.muted('│')}  ${chalk.bold(TOOL_CATEGORY_LABELS[category])}`);
        for (const tool of categoryTools) {
          const badge = tool.installed ? statusBadge('pass') : statusBadge('skip');
          const name = tool.installed ? chalk.white(tool.name) : theme.muted(tool.name);
          const version = tool.version ? theme.muted(` v${tool.version}`) : '';
          const notFound = !tool.installed ? theme.muted(' not found') : '';
          console.log(`  ${theme.muted('│')}    ${badge}  ${name}${version}${notFound}`);
        }
        console.log(connector());
      }

      // Recommendations section
      const recommendations = diagnostics
        .flatMap((r) =>
          r.checks.map((c) => ({ ...c, pluginName: r.pluginName, displayName: r.displayName })),
        )
        .filter((c) => (c.status === 'fail' || c.status === 'warn') && c.suggestion);

      if (recommendations.length > 0) {
        console.log();
        console.log(
          sectionHeader(`Recommendations (${recommendations.length})`, theme.highlight('✦')),
        );
        console.log(connector());
        recommendations.forEach((c, i) => {
          const badge = statusBadge(c.status);
          const pluginTag = theme.muted(`[${c.displayName}]`);
          console.log(`  ${theme.muted('│')}  ${theme.muted(`${i + 1}.`)} ${badge}  ${pluginTag}`);
          const lines = c.suggestion!.split('\n');
          for (const line of lines) {
            console.log(`  ${theme.muted('│')}      ${chalk.hex('#A78BFA')(line)}`);
          }
          if (i < recommendations.length - 1) {
            console.log(`  ${theme.muted('│')}`);
          }
        });
      }

      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();

      if (options.output) {
        const mdContent = new (
          await import('../reporting/markdown-renderer.js')
        ).MarkdownRenderer().renderDoctor(doctorResult);
        const filePath = writeReport(mdContent, options.output, config?.reportOutputDir);
        console.log(`  ${theme.muted('Report saved to')} ${chalk.white(filePath)}`);
        console.log();
      }
    });
}
