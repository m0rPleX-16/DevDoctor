/**
 * Info Command
 *
 * The `devdoctor info` command.
 *
 * Displays comprehensive system information in a styled, readable format.
 * This is useful for quickly understanding the current development
 * environment without needing to remember platform-specific commands.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { collectSystemInfo, formatBytes, formatUptime } from '../../infra/system/system-info-collector.js';
import { createSpinner } from '../ui/spinner.js';
import { logger } from '../ui/logger.js';

/**
 * Render a key-value pair with consistent alignment.
 */
function renderField(label: string, value: string, labelWidth: number = 16): void {
  const paddedLabel = label.padEnd(labelWidth);
  console.log(`  ${chalk.dim(paddedLabel)} ${value}`);
}

/**
 * Create the `info` command.
 *
 * @returns The configured Commander command
 */
export function createInfoCommand(): Command {
  return new Command('info')
    .description('Display system and environment information.')
    .action(async () => {
      const spinner = createSpinner('Collecting system information...');

      const info = await collectSystemInfo();

      spinner.stop();

      // Operating System section
      logger.header('Operating System');
      renderField('Platform', info.os.name);
      renderField('Architecture', info.os.architecture);
      renderField('Uptime', formatUptime(info.os.uptimeSeconds));

      // CPU section
      logger.header('CPU');
      renderField('Model', info.cpu.model);
      renderField('Cores', `${info.cpu.cores} logical cores`);

      // Memory section
      logger.header('Memory');
      renderField('Total', formatBytes(info.memory.totalBytes));
      renderField('Used', formatBytes(info.memory.usedBytes));
      renderField('Free', formatBytes(info.memory.freeBytes));
      renderField('Usage', `${info.memory.usagePercent}%`);

      // Create a simple memory usage bar
      const barLength = 30;
      const filledLength = Math.round((info.memory.usagePercent / 100) * barLength);
      const emptyLength = barLength - filledLength;
      const usageColor =
        info.memory.usagePercent > 90
          ? chalk.red
          : info.memory.usagePercent > 70
            ? chalk.yellow
            : chalk.green;
      const bar =
        usageColor('█'.repeat(filledLength)) + chalk.dim('░'.repeat(emptyLength));
      console.log(`  ${''.padEnd(16)} [${bar}]`);

      // Runtime section
      logger.header('Runtime');
      renderField('Node.js', info.runtime.nodeVersion);
      if (info.runtime.npmVersion) {
        renderField('npm', `v${info.runtime.npmVersion}`);
      }
      renderField('Working Dir', info.runtime.cwd);
      renderField('Home Dir', info.runtime.homeDir);

      logger.newline();
    });
}
