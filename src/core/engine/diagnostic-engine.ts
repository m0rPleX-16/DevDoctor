/**
 * Diagnostic Engine
 *
 * The orchestrator that connects the CLI to plugins.
 * It receives a plugin name, looks it up in the registry,
 * and delegates the actual diagnostic work to the plugin.
 *
 * Architecture note:
 * This is part of the Core/Application layer. It coordinates use cases
 * but contains no technology-specific logic. It doesn't know how to
 * check if MySQL is running — it only knows how to ask a plugin to check.
 *
 * Design Pattern: Facade
 * Provides a simple interface to the CLI layer, hiding the complexity
 * of plugin lookup, timing, and result aggregation.
 */

import type { DiagnosticResult } from '../types/diagnostic.js';
import type { PluginRegistry } from '../../plugins/plugin-registry.js';

export class DiagnosticEngine {
  constructor(private readonly registry: PluginRegistry) {}

  /**
   * Run diagnostics for a specific plugin.
   *
   * @param pluginName - The plugin identifier (e.g., "node", "mysql")
   * @returns The diagnostic result, or null if the plugin wasn't found
   * @throws Never — errors are caught and returned as failed diagnostics
   */
  async runDiagnostics(pluginName: string): Promise<DiagnosticResult | null> {
    const plugin = this.registry.get(pluginName);

    if (!plugin) {
      return null;
    }

    try {
      return await plugin.diagnose();
    } catch (error) {
      // If a plugin throws unexpectedly, wrap it in a failed result
      // rather than crashing the entire application.
      return {
        pluginName: plugin.name,
        displayName: plugin.displayName,
        timestamp: new Date(),
        durationMs: 0,
        checks: [
          {
            name: 'plugin-error',
            label: 'Plugin Execution',
            status: 'fail',
            message: `Plugin "${plugin.displayName}" encountered an unexpected error.`,
            detail: error instanceof Error ? error.message : String(error),
            suggestion: 'This may be a bug in the plugin. Try running the command again.',
          },
        ],
        overallStatus: 'fail',
      };
    }
  }

  /**
   * Run diagnostics for ALL registered plugins.
   * Useful for a future `devdoctor doctor` command.
   */
  async runAll(): Promise<DiagnosticResult[]> {
    const plugins = this.registry.list();
    const results: DiagnosticResult[] = [];

    for (const plugin of plugins) {
      const result = await this.runDiagnostics(plugin.name);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get the list of available plugin names.
   * Used by the CLI to show available options.
   */
  getAvailablePlugins(): string[] {
    return this.registry.list().map((p) => p.name);
  }
}
