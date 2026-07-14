#!/usr/bin/env node

/**
 * Dev Doctor — CLI Entry Point (Composition Root)
 *
 * This file wires all concrete implementations together.
 * It is the only place in the codebase that knows about ALL layers.
 *
 * Bootstrap sequence:
 *   1. Load configuration
 *   2. Load and register plugins via PluginLoader
 *   3. Create the DiagnosticEngine
 *   4. Create the RepairEngine with a FileAuditLogger (ADR-0010, ADR-0011)
 *   5. Register Commander commands with resolved config injected
 *   6. Parse and dispatch
 */

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { showBanner } from './ui/banner.js';
import { PluginRegistry } from '../plugins/plugin-registry.js';
import { DiagnosticEngine } from '../core/engine/diagnostic-engine.js';
import { RepairEngine } from '../core/engine/repair-engine.js';
import { FileAuditLogger } from '../infra/audit/audit-logger.js';
import { loadConfig } from '../infra/config/config-loader.js';
import { loadPlugins } from '../infra/plugins/plugin-loader.js';
import { createDiagnoseCommand } from './commands/diagnose.js';
import { createInfoCommand } from './commands/info.js';
import { createEnvCommand } from './commands/env.js';
import { createDoctorCommand } from './commands/doctor.js';
import { createFixCommand } from './commands/fix.js';
import { createCompletionCommand } from './commands/completion.js';
import { createHistoryCommand } from './commands/history.js';
import { createRollbackCommand } from './commands/rollback.js';
import { createConfigCommand } from './commands/config.js';
import { createCleanCommand } from './commands/clean.js';
import { FileHistoryStore } from '../infra/audit/history-store.js';
import { runInteractiveMenu, waitReturnToMenu } from './ui/interactive.js';
import chalk from 'chalk';
import { theme } from './ui/formatter.js';

// Fix #8: read version from package.json so a version bump only needs
// to touch one file, rather than package.json + this file.
const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require('../../package.json') as { version: string };

async function main(): Promise<void> {
  // ── Step 1: Load configuration ──
  //
  // Reads devdoctor.json (project) and ~/.devdoctor/config.json (user),
  // merges them, and applies defaults. Never throws — bad config = defaults.
  const config = loadConfig();

  // ── Step 2: Load plugins ──
  //
  // Built-in plugins are always loaded. Dynamic discovery supplements
  // them with any additional plugins found in the plugins directory.
  // Plugins listed as disabled in config are skipped.
  const registry = new PluginRegistry();
  await loadPlugins(registry, config);

  // ── Step 3: Create the diagnostic engine ──
  const engine = new DiagnosticEngine(registry);

  // ── Step 4: Create the repair engine with audit logging (ADR-0010, ADR-0011) ──
  //
  // FileAuditLogger appends to ~/.devdoctor/history.json after every repair action.
  // The audit logger is injected here (composition root) so the core RepairEngine
  // does not depend directly on the filesystem infrastructure.
  const auditLogger = new FileAuditLogger();
  const repairEngine = new RepairEngine(registry, auditLogger);
  const historyStore = new FileHistoryStore();

  // ── Step 5: Execute ──
  //
  // When no arguments are given, launch the interactive menu in a TTY.
  // In non-interactive environments (pipes, CI) fall back to help output.
  if (process.argv.length <= 2 && process.stdin.isTTY && process.stdout.isTTY) {
    const pluginNames = registry.getNames();

    while (true) {
      console.clear();
      showBanner();
      const argv = await runInteractiveMenu(pluginNames, process.argv.slice(0, 2));

      if (!argv) {
        // User quit menu (Esc / q)
        break;
      }

      // Create a fresh Program instance on every iteration to avoid option/parser state leakage
      const program = buildProgram(PKG_VERSION, registry, engine, repairEngine, config, historyStore);
      program.exitOverride(); // Prevent process.exit() so we can return to the menu loop on errors/help

      try {
        await program.parseAsync(argv);
      } catch (err: any) {
        // Ignore expected Displayed help exit or other commander exit overrides
        if (err.code !== 'commander.helpDisplayed' && err.code !== 'commander.executeSubCommandAsync') {
          console.error(`\n  ${theme.error(`Command error: ${err.message}`)}`);
        }
      }

      await waitReturnToMenu();
    }
    process.exit(0);
  } else {
    // Standard command-line execution
    const program = buildProgram(PKG_VERSION, registry, engine, repairEngine, config, historyStore);
    await program.parseAsync(process.argv);
  }
}

/**
 * Build and configure a new Commander Program instance.
 */
function buildProgram(
  version: string,
  registry: PluginRegistry,
  engine: DiagnosticEngine,
  repairEngine: RepairEngine,
  config: any,
  historyStore: any,
): Command {
  const program = new Command();

  program
    .name('devdoctor')
    .description(
      'A plugin-based CLI utility that diagnoses, explains, and safely repairs ' +
        'common development environment issues.',
    )
    .version(version, '-V, --version', 'Display the current version')
    .option('-q, --quiet', 'Suppress all styling, banners, and spinners');

  program.hook('preAction', (thisCommand) => {
    if (thisCommand.opts().quiet) {
      chalk.level = 0; // Suppress colors globally
      process.env.DEVDOCTOR_QUIET = '1'; // Signal to UI components
    }
  });

  // Pass resolved config into commands that need format/output options
  program.addCommand(createDiagnoseCommand(engine, config));
  program.addCommand(createInfoCommand());
  program.addCommand(createEnvCommand());
  program.addCommand(createDoctorCommand(engine, config, historyStore, registry));
  program.addCommand(createFixCommand(registry, engine, repairEngine));
  program.addCommand(createCompletionCommand('devdoctor'));
  program.addCommand(createHistoryCommand(historyStore));
  program.addCommand(createRollbackCommand(registry, repairEngine));
  program.addCommand(createConfigCommand());
  program.addCommand(createCleanCommand());

  program.addHelpText('before', () => {
    showBanner();
    return '';
  });

  program.addHelpText('after', () => {
    const available = registry.list()
      .map((p) => `${chalk.bold(p.name.padEnd(8))} ${theme.muted(p.description)}`)
      .join('\n  ');
    return `
Available Plugins:
  ${available}

Examples:
  ${chalk.cyan('devdoctor diagnose mysql')}
  ${chalk.cyan('devdoctor fix mysql')}
  ${chalk.cyan('devdoctor fix mysql --dry-run')}
  ${chalk.cyan('devdoctor fix mysql --yes')}
  ${chalk.cyan('devdoctor doctor --format json')}
  ${chalk.cyan('devdoctor rollback mysql mysql-service')}
  ${chalk.cyan('devdoctor history --last 20')}
  ${chalk.cyan('devdoctor diagnose redis')}
  ${chalk.cyan('devdoctor diagnose python')}
  ${chalk.cyan('devdoctor config init')}
  ${chalk.cyan('devdoctor config show')}
  ${chalk.cyan('devdoctor clean snapshot')}
  ${chalk.cyan('devdoctor clean lock')}
  ${chalk.cyan('devdoctor clean all --yes')}
`;
  });

  return program;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
