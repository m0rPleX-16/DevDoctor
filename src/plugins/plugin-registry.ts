/**
 * Plugin Registry
 *
 * Central registry that manages all available plugins.
 * In Phase 1, plugins are registered manually during bootstrap.
 * In Phase 5, this will support dynamic plugin discovery and loading.
 *
 * Design Pattern: Registry Pattern
 * A well-known pattern for managing a collection of related objects
 * that can be looked up by a key. Similar to a Service Locator,
 * but scoped specifically to plugins.
 *
 * Architecture note:
 * The registry sits at the boundary between the Core and Plugin layers.
 * It knows about the Plugin interface (Core), and holds references to
 * concrete plugin implementations, but doesn't depend on any specific plugin.
 */

import type { Plugin } from '../core/types/plugin.js';

export class PluginRegistry {
  private readonly plugins: Map<string, Plugin> = new Map();

  /**
   * Register a plugin in the registry.
   *
   * @param plugin - The plugin instance to register
   * @throws Error if a plugin with the same name is already registered
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(
        `Plugin "${plugin.name}" is already registered. ` +
          `Each plugin must have a unique name.`,
      );
    }

    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Look up a plugin by name.
   *
   * @param name - The plugin identifier (e.g., "node")
   * @returns The plugin instance, or undefined if not found
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if a plugin is registered.
   *
   * @param name - The plugin identifier
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get all registered plugins.
   *
   * @returns Array of all registered plugin instances
   */
  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get the names of all registered plugins.
   * Useful for CLI help text and error messages.
   */
  getNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get the total number of registered plugins.
   */
  get size(): number {
    return this.plugins.size;
  }
}
