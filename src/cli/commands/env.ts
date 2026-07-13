/**
 * Env Command
 *
 * The `devdoctor env` command.
 *
 * Displays development-relevant environment variables grouped by
 * technology, with educational descriptions and PATH validation.
 *
 * Options:
 *   --all   Show ALL environment variables, not just dev-relevant ones
 *   --path  Show only the PATH breakdown
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { scanEnvironment } from '../../infra/system/env-scanner.js';
import { showCompactBanner } from '../ui/banner.js';
import { createSpinner } from '../ui/spinner.js';
import {
  theme,
  hr,
  sectionHeader,
  field,
  connector,
  statusBadge,
} from '../ui/formatter.js';
import { ENV_CATEGORY_LABELS, type EnvCategory, type EnvVariable } from '../../core/types/environment.js';

/** Icons for each environment category */
const CATEGORY_ICONS: Record<EnvCategory, string> = {
  system: '🖥️',
  node: '🟢',
  java: '☕',
  python: '🐍',
  docker: '🐳',
  git: '📦',
  other: '📋',
};

/**
 * Render a single environment variable.
 */
function renderVariable(v: EnvVariable, showDescription: boolean): void {
  const nameStyle = v.value !== undefined ? chalk.white.bold : theme.muted;
  const valueText = v.value
    ? theme.text(v.value.length > 60 ? v.value.slice(0, 57) + '...' : v.value)
    : theme.error('not set');

  const badge = v.value !== undefined ? statusBadge('pass') : statusBadge('skip');
  const importantTag = v.important && v.value === undefined
    ? ` ${theme.warning('(recommended)')}`
    : '';

  console.log(`  ${theme.muted('│')}  ${badge}  ${nameStyle(v.name)}${importantTag}`);
  console.log(`  ${theme.muted('│')}     ${valueText}`);

  if (showDescription && v.description) {
    console.log(`  ${theme.muted('│')}     ${theme.muted(v.description)}`);
  }

  console.log(connector());
}

/**
 * Render the PATH breakdown.
 */
function renderPath(entries: Array<{ path: string; index: number; exists: boolean }>): void {
  console.log();
  console.log(sectionHeader('PATH Entries', '🔗'));
  console.log(connector());
  console.log(`  ${theme.muted('│')}  ${theme.muted(`${entries.length} directories · Priority: top = highest`)}`);
  console.log(connector());

  for (const entry of entries) {
    const badge = entry.exists ? statusBadge('pass') : statusBadge('fail');
    const label = entry.exists ? theme.text(entry.path) : theme.error(entry.path);
    const status = entry.exists ? '' : ` ${theme.error('(not found)')}`;
    const index = theme.muted(`${String(entry.index + 1).padStart(2)}.`);

    console.log(`  ${theme.muted('│')}  ${index} ${badge}  ${label}${status}`);
  }

  const missing = entries.filter((e) => !e.exists);
  if (missing.length > 0) {
    console.log(connector());
    console.log(`  ${theme.muted('│')}  ${theme.warning(`⚠ ${missing.length} PATH entries point to directories that don't exist.`)}`);
    console.log(`  ${theme.muted('│')}  ${theme.muted('Missing entries can slow down command lookups and cause confusion.')}`);
  }
}

/**
 * Create the `env` command.
 */
export function createEnvCommand(): Command {
  return new Command('env')
    .description('Display development-relevant environment variables.')
    .option('--all', 'Show ALL environment variables, not just dev-relevant ones')
    .option('--path', 'Show only the PATH breakdown')
    .action(async (options: { all?: boolean; path?: boolean }) => {
      showCompactBanner();

      const spinner = createSpinner('Scanning environment...');
      const envInfo = scanEnvironment(options.all ?? false);
      spinner.stop();

      console.log();
      console.log(`  ${hr('Environment', 48)}`);
      console.log();
      console.log(`  ${theme.muted(`${envInfo.totalVarCount} total variables · showing ${options.all ? 'all' : 'dev-relevant'}`)}`);

      // PATH-only mode
      if (options.path) {
        renderPath(envInfo.pathEntries);
        console.log();
        console.log(`  ${hr(undefined, 48)}`);
        console.log();
        return;
      }

      // Group variables by category
      const grouped = new Map<EnvCategory, EnvVariable[]>();
      for (const v of envInfo.variables) {
        if (v.name === 'PATH') continue; // PATH gets its own section
        const list = grouped.get(v.category) ?? [];
        list.push(v);
        grouped.set(v.category, list);
      }

      // Render each category
      const categoryOrder: EnvCategory[] = ['system', 'node', 'java', 'python', 'docker', 'git', 'other'];

      for (const category of categoryOrder) {
        const vars = grouped.get(category);
        if (!vars || vars.length === 0) continue;

        const icon = CATEGORY_ICONS[category];
        const label = ENV_CATEGORY_LABELS[category];

        console.log();
        console.log(sectionHeader(label, icon));
        console.log(connector());

        for (const v of vars) {
          renderVariable(v, !options.all); // Show descriptions only in filtered mode
        }
      }

      // Always show PATH breakdown
      renderPath(envInfo.pathEntries);

      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();

      if (!options.all) {
        console.log(`  ${theme.muted('Tip: Use')} ${chalk.white('--all')} ${theme.muted('to see all environment variables.')}`);
        console.log(`  ${theme.muted('     Use')} ${chalk.white('--path')} ${theme.muted('to see only the PATH breakdown.')}`);
        console.log();
      }
    });
}
