/**
 * Info Command
 *
 * The `devdoctor info` command.
 *
 * Displays comprehensive system information in a styled, readable format.
 * Supports --format terminal (default) and --format json for machine-readable output.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { collectSystemInfo, formatBytes, formatUptime } from '../../infra/system/system-info-collector.js';
import { detectProjectContext } from '../../infra/system/project-detector.js';
import { createSpinner } from '../ui/spinner.js';
import { showCompactBanner } from '../ui/banner.js';
import {
  theme,
  hr,
  sectionHeader,
  field,
  connector,
  progressBar,
  statusBadge,
} from '../ui/formatter.js';

interface InfoOptions {
  format?: 'terminal' | 'json';
}

/**
 * Create the `info` command.
 *
 * @returns The configured Commander command
 */
export function createInfoCommand(
  registry?: import('../../plugins/plugin-registry.js').PluginRegistry,
): Command {
  return new Command('info')
    .description('Display system and environment information.')
    .option('-f, --format <format>', 'Output format: terminal (default), json', 'terminal')
    .action(async (options: InfoOptions) => {
      const format = options.format ?? 'terminal';

      if (format !== 'terminal' && format !== 'json') {
        console.error(`  ${theme.error(`✖ Unknown format: "${format}". Use terminal or json.`)}`);
        process.exitCode = 1;
        return;
      }

      if (format === 'json') {
        // No banner or spinner for machine-readable output
        const info = await collectSystemInfo();
        process.stdout.write(JSON.stringify(info, null, 2) + '\n');
        return;
      }

      showCompactBanner();

      const spinner = createSpinner('Collecting system information...');

      const info = await collectSystemInfo();

      spinner.stop();

      console.log();
      console.log(`  ${hr('System Information', 48)}`);

      // Operating System section
      console.log();
      console.log(sectionHeader('Operating System', theme.accent('❖')));
      console.log(connector());
      console.log(field('Platform', info.os.name));
      console.log(field('Architecture', info.os.architecture));
      console.log(field('Uptime', formatUptime(info.os.uptimeSeconds)));

      // CPU section
      console.log();
      console.log(sectionHeader('CPU', theme.accent('✦')));
      console.log(connector());
      console.log(field('Model', info.cpu.model));
      console.log(field('Cores', `${info.cpu.cores} logical cores`));

      // Memory section
      console.log();
      console.log(sectionHeader('Memory', theme.accent('⬡')));
      console.log(connector());
      console.log(field('Total', formatBytes(info.memory.totalBytes)));
      console.log(field('Used', formatBytes(info.memory.usedBytes)));
      console.log(field('Free', formatBytes(info.memory.freeBytes)));
      console.log(connector());
      console.log(`  ${theme.muted('│')}  ${theme.muted('Usage'.padEnd(14))} ${progressBar(info.memory.usagePercent)}`);

      // Runtime section
      console.log();
      console.log(sectionHeader('Runtime', theme.accent('⚙')));
      console.log(connector());
      console.log(field('Node.js', info.runtime.nodeVersion));
      if (info.runtime.npmVersion) {
        console.log(field('npm', `v${info.runtime.npmVersion}`));
      }
      console.log(field('Working Dir', info.runtime.cwd));
      console.log(field('Home Dir', info.runtime.homeDir));

      // Development Tools section
      if (info.tools.length > 0) {
        console.log();
        console.log(sectionHeader('Development Tools', theme.accent('⚒')));
        console.log(connector());

        const installed = info.tools.filter((t) => t.installed);
        const missing = info.tools.filter((t) => !t.installed);

        for (const tool of installed) {
          const badge = statusBadge('pass');
          const version = tool.version ? theme.muted(`v${tool.version}`) : '';
          console.log(`  ${theme.muted('│')}  ${badge}  ${chalk.white(tool.name)}  ${version}`);
        }

        if (missing.length > 0) {
          for (const tool of missing) {
            const badge = statusBadge('skip');
            console.log(`  ${theme.muted('│')}  ${badge}  ${theme.muted(tool.name)}  ${theme.muted('not found')}`);
          }
        }
      }

      // Project Context section — only shown when markers are detected
      if (registry) {
        const allPlugins = registry.list();
        const projectCtx = detectProjectContext(allPlugins);

        if (projectCtx.detectedPlugins.size > 0) {
          console.log();
          console.log(sectionHeader('Project Context', theme.accent('◈')));
          console.log(connector());
          console.log(`  ${theme.muted('│')}  ${theme.muted(`Detected in ${chalk.white(process.cwd())}`)}`);
          console.log(connector());
          for (const [pluginName, markers] of Object.entries(projectCtx.matchedMarkers)) {
            const plugin = allPlugins.find((p) => p.name === pluginName);
            const displayName = plugin?.displayName ?? pluginName;
            console.log(
              `  ${theme.muted('│')}  ${statusBadge('pass')}  ${chalk.white(displayName)}` +
              `  ${theme.muted(`(${markers.join(', ')})`)}`,
            );
          }
          console.log(connector());
          console.log(
            `  ${theme.muted('│')}  ${theme.muted('Run')} ${chalk.white('devdoctor doctor')} ` +
            `${theme.muted('to diagnose all detected plugins.')}`,
          );
        }
      }

      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();
    });
}

