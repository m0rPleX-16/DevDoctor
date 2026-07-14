/**
 * Config Command
 *
 * `devdoctor config init`   — scaffold a devdoctor.json in the current directory
 * `devdoctor config show`   — display the resolved configuration in use
 * `devdoctor config path`   — print the paths of all config files DevDoctor reads
 *
 * Why this matters:
 * DevDoctor reads two config files (user-level and project-level) and merges
 * them silently. Without a way to inspect or scaffold config, users have no
 * feedback loop when a setting isn't taking effect.
 */

import fs from 'node:fs';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadConfig,
  getProjectConfigPath,
  getUserConfigPath,
  writeProjectConfig,
} from '../../infra/config/config-loader.js';
import { showCompactBanner } from '../ui/banner.js';
import { theme, hr, field, sectionHeader, connector } from '../ui/formatter.js';

// ── Helpers ───────────────────────────────────────────────────────

function formatPlugins(plugins: Record<string, { disabled?: boolean }>): string {
  const entries = Object.entries(plugins);
  if (entries.length === 0) return theme.muted('(none configured)');
  return entries
    .map(([name, cfg]) =>
      `${chalk.white(name)}: ${cfg.disabled ? theme.error('disabled') : theme.success('enabled')}`,
    )
    .join(', ');
}

// ── Command factory ───────────────────────────────────────────────

export function createConfigCommand(): Command {
  const config = new Command('config')
    .description('Manage DevDoctor configuration.');

  // ── config init ──
  config
    .command('init')
    .description('Scaffold a devdoctor.json in the current directory.')
    .option('--force', 'Overwrite an existing devdoctor.json')
    .action((options: { force?: boolean }) => {
      const configPath = getProjectConfigPath();

      if (fs.existsSync(configPath) && !options.force) {
        console.log();
        console.log(`  ${theme.warning(`⚠ devdoctor.json already exists at:`)}`);
        console.log(`    ${chalk.white(configPath)}`);
        console.log();
        console.log(
          `  ${theme.muted('Use')} ${chalk.white('devdoctor config init --force')} ` +
          `${theme.muted('to overwrite it.')}`,
        );
        console.log();
        return;
      }

      try {
        writeProjectConfig({
          defaultFormat: 'terminal',
          reportOutputDir: './reports',
          plugins: {},
        });

        console.log();
        console.log(`  ${theme.success('✓')} Created ${chalk.white('devdoctor.json')} at:`);
        console.log(`    ${chalk.white(configPath)}`);
        console.log();
        console.log(`  ${theme.muted('Edit it to customise output format, report directory, and plugin settings.')}`);
        console.log(`  ${theme.muted('Run')} ${chalk.white('devdoctor config show')} ${theme.muted('to see the resolved config.')}`);
        console.log();
      } catch (err) {
        console.log();
        console.log(
          `  ${theme.error(`✖ Failed to write devdoctor.json: ${err instanceof Error ? err.message : String(err)}`)}`,
        );
        console.log();
        process.exitCode = 1;
      }
    });

  // ── config show ──
  config
    .command('show')
    .description('Display the resolved configuration currently in use.')
    .action(() => {
      showCompactBanner();

      let resolved;
      try {
        resolved = loadConfig();
      } catch (err) {
        console.log();
        console.log(`  ${theme.error(`✖ Could not load configuration: ${err instanceof Error ? err.message : String(err)}`)}`);
        console.log(`  ${theme.muted('Check your devdoctor.json for syntax errors, or run')} ${chalk.white('devdoctor config path')} ${theme.muted('to locate the file.')}`);
        console.log();
        process.exitCode = 1;
        return;
      }

      console.log();
      console.log(`  ${hr('Resolved Configuration', 48)}`);
      console.log();
      console.log(sectionHeader('Settings', '⚙️'));
      console.log(connector());
      console.log(field('Default format', resolved.defaultFormat));
      console.log(field('Report output dir', resolved.reportOutputDir));
      console.log(field('Plugins', formatPlugins(resolved.plugins)));
      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();
    });

  // ── config path ──
  config
    .command('path')
    .description('Print the paths of all config files DevDoctor reads.')
    .action(() => {
      const projectPath = getProjectConfigPath();
      const userPath = getUserConfigPath();

      console.log();
      console.log(`  ${theme.muted('User-level config  (lower priority):')}`);
      console.log(
        `    ${fs.existsSync(userPath) ? theme.success('✓') : theme.muted('○')}  ` +
        `${chalk.white(userPath)}` +
        `${fs.existsSync(userPath) ? '' : theme.muted('  (not found)')}`,
      );
      console.log();
      console.log(`  ${theme.muted('Project-level config (higher priority):')}`);
      console.log(
        `    ${fs.existsSync(projectPath) ? theme.success('✓') : theme.muted('○')}  ` +
        `${chalk.white(projectPath)}` +
        `${fs.existsSync(projectPath) ? '' : theme.muted('  (not found)')}`,
      );
      console.log();
      console.log(
        `  ${theme.muted('Project config overrides user config. ' +
        'Run')} ${chalk.white('devdoctor config init')} ${theme.muted('to create one.')}`,
      );
      console.log();
    });

  return config;
}
