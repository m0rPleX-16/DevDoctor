#!/usr/bin/env node

/**
 * Dev Doctor — CLI Entry Point (Composition Root)
 *
 * This file wires all concrete implementations together.
 * It is the only place in the codebase that knows about ALL layers.
 *
 * Bootstrap sequence:
 *   1. Load configuration (Phase 7)
 *   2. Load and register plugins via PluginLoader (Phase 5)
 *   3. Create the DiagnosticEngine
 *   4. Register Commander commands with resolved config injected
 *   5. Parse and dispatch
 */

import { Command } from 'commander';
import { showBanner } from './ui/banner.js';
import { PluginRegistry } from '../plugins/plugin-registry.js';
import { DiagnosticEngine } from '../core/engine/diagnostic-engine.js';
import { loadConfig } from '../infra/config/config-loader.js';
import { loadPlugins } from '../infra/plugins/plugin-loader.js';
import { createDiagnoseCommand } from './commands/diagnose.js';
import { createInfoCommand } from './commands/info.js';
import { createEnvCommand } from './commands/env.js';
import { createDoctorCommand } from './commands/doctor.js';
import { createFixCommand } from './commands/fix.js';

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

  // ── Step 4: Set up Commander ──
  const program = new Command();

  program
    .name('devdoctor')
    .description(
      'A plugin-based CLI utility that diagnoses, explains, and safely repairs ' +
        'common development environment issues.',
    )
    .version('0.1.0', '-V, --version', 'Display the current version');

  // Pass resolved config into commands that need format/output options
  program.addCommand(createDiagnoseCommand(engine, config));
  program.addCommand(createInfoCommand());
  program.addCommand(createEnvCommand());
  program.addCommand(createDoctorCommand(engine, config));
  program.addCommand(createFixCommand(registry, engine));

  program.action(() => {
    showBanner();
    program.outputHelp();
  });

  // ── Step 5: Parse and dispatch ──
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
