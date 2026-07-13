/**
 * Info Command
 *
 * The `devdoctor info` command.
 *
 * Displays comprehensive system information in a styled, readable format.
 * Uses section headers with accent bars and consistent field alignment
 * for a polished, professional look.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { collectSystemInfo, formatBytes, formatUptime } from '../../infra/system/system-info-collector.js';
import { createSpinner } from '../ui/spinner.js';
import { showCompactBanner } from '../ui/banner.js';
import type { DetectedTool } from '../../core/types/doctor-result.js';
import {
  theme,
  hr,
  sectionHeader,
  field,
  connector,
  progressBar,
  statusBadge,
} from '../ui/formatter.js';

/**
 * Create the `info` command.
 *
 * @returns The configured Commander command
 */
export function createInfoCommand(): Command {
  return new Command('info')
    .description('Display system and environment information.')
    .action(async () => {
      showCompactBanner();

      const spinner = createSpinner('Collecting system information...');

      const info = await collectSystemInfo();

      spinner.stop();

      console.log();
      console.log(`  ${hr('System Information', 48)}`);

      // Operating System section
      console.log();
      console.log(sectionHeader('Operating System', '💻'));
      console.log(connector());
      console.log(field('Platform', info.os.name));
      console.log(field('Architecture', info.os.architecture));
      console.log(field('Uptime', formatUptime(info.os.uptimeSeconds)));

      // CPU section
      console.log();
      console.log(sectionHeader('CPU', '⚡'));
      console.log(connector());
      console.log(field('Model', info.cpu.model));
      console.log(field('Cores', `${info.cpu.cores} logical cores`));

      // Memory section
      console.log();
      console.log(sectionHeader('Memory', '🧠'));
      console.log(connector());
      console.log(field('Total', formatBytes(info.memory.totalBytes)));
      console.log(field('Used', formatBytes(info.memory.usedBytes)));
      console.log(field('Free', formatBytes(info.memory.freeBytes)));
      console.log(connector());
      console.log(`  ${theme.muted('│')}  ${progressBar(info.memory.usagePercent)}`);

      // Runtime section
      console.log();
      console.log(sectionHeader('Runtime', '🔧'));
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
        console.log(sectionHeader('Development Tools', '🧰'));
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

      console.log();
      console.log(`  ${hr(undefined, 48)}`);
      console.log();
    });
}

