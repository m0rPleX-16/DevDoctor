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
 *
 * ADR-0010: runAll() now runs plugins concurrently via Promise.allSettled()
 * and applies a per-plugin timeout so a hung plugin can't block the dashboard.
 */

import type { DiagnosticResult } from '../types/diagnostic.js';
import type { PluginRegistry } from '../plugin-registry.js';

/** Default per-plugin timeout for runAll() in milliseconds. */
const DEFAULT_PLUGIN_TIMEOUT_MS = 30_000;

export class DiagnosticEngine {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly pluginTimeoutMs: number = DEFAULT_PLUGIN_TIMEOUT_MS,
  ) {}

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
   * Run diagnostics for ALL registered plugins (or a specific subset) concurrently.
   *
   * ADR-0010: Uses Promise.allSettled() so plugins run in parallel and
   * a single failure doesn't prevent the remaining plugins from completing.
   * Each plugin is wrapped in a per-plugin timeout (default 30 s); a timed-out
   * plugin produces a 'skip' result rather than blocking the dashboard forever.
   *
   * @param pluginNames - Optional array of plugin names to restrict execution to
   * @returns Array of DiagnosticResult for plugins, in registration order
   */
  async runAll(pluginNames?: string[]): Promise<DiagnosticResult[]> {
    const plugins = pluginNames
      ? pluginNames
          .map((name) => this.registry.get(name))
          .filter((p): p is NonNullable<typeof p> => p !== undefined)
      : this.registry.list();

    const settlements = await Promise.allSettled(
      plugins.map((plugin) => this.runWithTimeout(plugin.name)),
    );

    const results: DiagnosticResult[] = [];
    for (const settled of settlements) {
      if (settled.status === 'fulfilled' && settled.value !== null) {
        results.push(settled.value);
      }
      // Rejected settlements are already handled inside runWithTimeout —
      // it never resolves to a rejected promise.
    }

    return results;
  }

  /**
   * Run a single plugin's diagnostics with a timeout guard.
   *
   * Returns a skip result if the plugin exceeds pluginTimeoutMs.
   * Never rejects.
   */
  private async runWithTimeout(pluginName: string): Promise<DiagnosticResult | null> {
    const plugin = this.registry.get(pluginName);
    if (!plugin) return null;

    const timeoutResult: DiagnosticResult = {
      pluginName: plugin.name,
      displayName: plugin.displayName,
      timestamp: new Date(),
      durationMs: this.pluginTimeoutMs,
      checks: [
        {
          name: 'plugin-timeout',
          label: 'Plugin Execution',
          status: 'skip',
          message: `Plugin "${plugin.displayName}" timed out after ${this.pluginTimeoutMs / 1000}s.`,
          detail:
            'The plugin did not complete within the allowed time. ' +
            'This may indicate a hung network call or a slow system command. ' +
            'Try running `devdoctor diagnose ' +
            plugin.name +
            '` to diagnose it individually.',
        },
      ],
      overallStatus: 'skip',
    };

    const timeoutPromise = new Promise<DiagnosticResult>((resolve) =>
      setTimeout(() => resolve(timeoutResult), this.pluginTimeoutMs),
    );

    try {
      const result = await Promise.race([this.runDiagnostics(pluginName), timeoutPromise]);
      return result;
    } catch {
      return timeoutResult;
    }
  }

  /**
   * Get the list of available plugin names.
   * Used by the CLI to show available options.
   */
  getAvailablePlugins(): string[] {
    return this.registry.list().map((p) => p.name);
  }
}
