#!/usr/bin/env node

/**
 * Dev Doctor — CLI Entry Point
 *
 * This is the main entry point for the Dev Doctor CLI application.
 * It bootstraps the application by:
 *
 * 1. Creating the plugin registry and registering available plugins
 * 2. Creating the diagnostic engine
 * 3. Setting up Commander with all commands
 * 4. Parsing command-line arguments
 *
 * Architecture note:
 * This file is the "Composition Root" — the place where all the pieces
 * are wired together. It's the only file that knows about ALL concrete
 * implementations. Every other module depends on abstractions (interfaces).
 *
 * This is the Dependency Injection principle at work: dependencies flow
 * inward (from this outer layer to the core), and this file is where
 * concrete implementations are connected to the abstractions they fulfill.
 */

import { Command } from 'commander';
import { showBanner } from './ui/banner.js';
import { PluginRegistry } from '../plugins/plugin-registry.js';
import { DiagnosticEngine } from '../core/engine/diagnostic-engine.js';
import { NodePlugin } from '../plugins/node/index.js';
import { MysqlPlugin } from '../plugins/mysql/index.js';
import { createDiagnoseCommand } from './commands/diagnose.js';
import { createInfoCommand } from './commands/info.js';
import { createEnvCommand } from './commands/env.js';
import { createDoctorCommand } from './commands/doctor.js';
import { createFixCommand } from './commands/fix.js';

/**
 * Bootstrap and run the CLI application.
 */
async function main(): Promise<void> {
  // ── Step 1: Create the plugin registry and register plugins ──
  //
  // In Phase 1, plugins are registered manually here.
  // In Phase 5, this will be replaced with dynamic plugin discovery.
  const registry = new PluginRegistry();
  registry.register(new NodePlugin());
  registry.register(new MysqlPlugin());

  // ── Step 2: Create the diagnostic engine ──
  //
  // The engine is the bridge between the CLI and the plugins.
  // It knows how to look up plugins and run their diagnostics.
  const engine = new DiagnosticEngine(registry);

  // ── Step 3: Set up Commander ──
  //
  // Commander is a popular library for building CLI applications in Node.js.
  // It handles argument parsing, help text generation, and command routing.
  const program = new Command();

  program
    .name('devdoctor')
    .description(
      'A plugin-based CLI utility that diagnoses, explains, and safely repairs ' +
        'common development environment issues.',
    )
    .version('0.1.0', '-V, --version', 'Display the current version');

  // Register commands
  program.addCommand(createDiagnoseCommand(engine));
  program.addCommand(createInfoCommand());
  program.addCommand(createEnvCommand());
  program.addCommand(createDoctorCommand(engine));
  program.addCommand(createFixCommand(registry, engine));

  // Show banner when no command is specified
  program.action(() => {
    showBanner();
    program.outputHelp();
  });

  // ── Step 4: Parse arguments and execute ──
  await program.parseAsync(process.argv);
}

// Run the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
