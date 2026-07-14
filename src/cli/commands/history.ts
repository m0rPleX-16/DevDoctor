/**
 * History Command
 *
 * The `devdoctor history` command — diagnostic run timeline.
 *
 * Reads ~/.devdoctor/runs.json (NDJSON) and renders a health score
 * timeline so developers can see when their environment degraded and
 * correlate it with changes they made.
 *
 * Options:
 *   -n, --last <n>        Show only the last N entries (default: 10)
 *   -f, --format <fmt>    Output format: terminal (default), json
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { IHistoryStore } from '../../infra/audit/history-store.js';
import { FileHistoryStore } from '../../infra/audit/history-store.js';
import type { HistoryEntry } from '../../core/types/history.js';
import { theme, hr, progressBar, statusBadge } from '../ui/formatter.js';
import { showCompactBanner } from '../ui/banner.js';

// ── Helpers ───────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const formatted = d.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    // Append UTC offset so timestamps are unambiguous across timezones
    const offsetMins = d.getTimezoneOffset();
    const sign = offsetMins <= 0 ? '+' : '-';
    const abs = Math.abs(offsetMins);
    const offsetStr = `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
    return `${formatted} ${offsetStr}`;
  } catch {
    return iso;
  }
}

function healthColor(status: HistoryEntry['status']): (s: string) => string {
  switch (status) {
    case 'healthy':   return theme.success;
    case 'degraded':  return theme.warning;
    case 'unhealthy': return theme.error;
  }
}

function renderTrendArrow(prev: HistoryEntry | undefined, curr: HistoryEntry): string {
  if (!prev) return theme.muted(' ');
  const diff = curr.percentage - prev.percentage;
  if (diff > 0) return chalk.green('↑');
  if (diff < 0) return chalk.red('↓');
  return theme.muted('→');
}

function renderPluginSummary(summary: Record<string, string>): string {
  return Object.entries(summary)
    .map(([name, status]) => {
      const badge = statusBadge(status as 'pass' | 'warn' | 'fail' | 'skip');
      return `${badge} ${theme.muted(name)}`;
    })
    .join('  ');
}

// ── Command factory ───────────────────────────────────────────────

interface HistoryOptions {
  last?: string;
  format?: string;
}

export function createHistoryCommand(historyStore: IHistoryStore): Command {
  return new Command('history')
    .description('Show a timeline of past health check runs.')
    .option('-n, --last <n>', 'Number of recent entries to show', '10')
    .option('-f, --format <format>', 'Output format: terminal (default), json', 'terminal')
    .action(async (options: HistoryOptions) => {
      const format = options.format ?? 'terminal';

      // Validate --format
      if (format !== 'terminal' && format !== 'json') {
        console.error(`  ${theme.error(`✖ Unknown format: "${format}". Use terminal or json.`)}`);
        process.exitCode = 1;
        return;
      }

      // Validate --last
      const rawLast = options.last ?? '10';
      const parsedLast = parseInt(rawLast, 10);
      if (isNaN(parsedLast) || parsedLast < 1) {
        console.error(`  ${theme.error(`✖ Invalid value for --last: "${rawLast}". Must be a positive integer.`)}`);
        process.exitCode = 1;
        return;
      }
      const last = parsedLast;

      let all: HistoryEntry[];
      try {
        all = historyStore.read();
      } catch (err) {
        console.error(`  ${theme.error(`✖ Could not read history: ${err instanceof Error ? err.message : String(err)}`)}`);
        console.error(`  ${theme.muted('The history file may be corrupted. Run')} ${chalk.white('devdoctor clean history')} ${theme.muted('to reset it.')}`);
        process.exitCode = 1;
        return;
      }
      const entries = all.slice(-last);

      // ── JSON format ──
      if (format === 'json') {
        process.stdout.write(JSON.stringify(entries, null, 2) + '\n');
        return;
      }

      // ── Terminal format ──
      showCompactBanner();

      console.log();
      console.log(`  ${hr('Health Score History', 48)}`);
      console.log();

      if (entries.length === 0) {
        console.log(`  ${theme.muted('No history recorded yet.')}`);
        console.log();
        console.log(`  ${theme.muted('Dev Doctor records a snapshot after every')} ${chalk.white('devdoctor doctor')} ${theme.muted('run.')}`);
        console.log(`  ${theme.muted('Each snapshot captures your health score, check counts, and per-plugin status.')}`);
        console.log();
        console.log(`  ${theme.muted('Run')} ${chalk.white('devdoctor doctor')} ${theme.muted('to record your first entry.')}`);
        console.log();
        return;
      }

      console.log(
        `  ${theme.muted('Showing last')} ${chalk.white(String(entries.length))} ` +
        `${theme.muted('of')} ${chalk.white(String(all.length))} ${theme.muted('total run(s).')}`,
      );
      console.log();

      // Header row
      console.log(
        `  ${theme.muted('Date/Time'.padEnd(24))}` +
        `${theme.muted('Score'.padEnd(7))}` +
        `${theme.muted('Bar'.padEnd(32))}` +
        `${theme.muted('Status'.padEnd(11))}` +
        `${theme.muted('Checks')}`,
      );
      console.log(`  ${theme.muted('─'.repeat(85))}`);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const prev = i > 0 ? entries[i - 1] : undefined;
        const colorFn = healthColor(entry.status);
        const trend = renderTrendArrow(prev, entry);
        const bar = progressBar(entry.percentage, 24, { invert: true });
        const score = colorFn(`${String(entry.percentage).padStart(3)}%`);
        const statusLabel = colorFn(entry.status.padEnd(9));
        const checksInfo = theme.muted(
          `${entry.passedChecks}/${entry.totalChecks}` +
          (entry.failedChecks > 0 ? chalk.red(` ${entry.failedChecks}✗`) : '') +
          (entry.warningChecks > 0 ? chalk.yellow(` ${entry.warningChecks}⚠`) : ''),
        );
        const time = theme.muted(formatTimestamp(entry.timestamp).padEnd(23));

        console.log(`  ${time} ${trend} ${score}  ${bar}  ${statusLabel} ${checksInfo}`);

        // Show plugin-level breakdown if any plugin had an issue
        const hasIssues = Object.values(entry.pluginSummary).some(
          (s) => s === 'fail' || s === 'warn',
        );
        if (hasIssues) {
          console.log(`  ${' '.repeat(24)}   ${renderPluginSummary(entry.pluginSummary)}`);
        }
      }

      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();
      console.log(
        `  ${theme.muted('History file:')} ${chalk.white(FileHistoryStore.filePath)}`,
      );
      console.log();
    });
}
