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

  // ── Step 5: Set up Commander ──
  const program = new Command();

  program
    .name('devdoctor')
    .description(
      'A plugin-based CLI utility that diagnoses, explains, and safely repairs ' +
        'common development environment issues.',
    )
    .version(PKG_VERSION, '-V, --version', 'Display the current version');

  // Pass resolved config into commands that need format/output options
  program.addCommand(createDiagnoseCommand(engine, config));
  program.addCommand(createInfoCommand());
  program.addCommand(createEnvCommand());
  program.addCommand(createDoctorCommand(engine, config));
  program.addCommand(createFixCommand(registry, engine, repairEngine));

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
`;
  });

  program.action(() => {
    program.outputHelp();
  });

  // ── Step 6: Parse and dispatch ──
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
