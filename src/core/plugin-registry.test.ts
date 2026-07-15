/**
 * Plugin Registry Tests
 *
 * Tests for the plugin registration and lookup logic.
 * These are pure unit tests with no external dependencies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from './plugin-registry.js';
import type { Plugin } from '../core/types/plugin.js';
import type { DiagnosticResult } from '../core/types/diagnostic.js';

/**
 * Create a mock plugin for testing.
 */
function createMockPlugin(name: string, displayName: string = name): Plugin {
  return {
    name,
    displayName,
    description: `Mock ${name} plugin`,
    async diagnose(): Promise<DiagnosticResult> {
      return {
        pluginName: name,
        displayName,
        timestamp: new Date(),
        durationMs: 0,
        checks: [],
        overallStatus: 'pass',
      };
    },
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('should register a plugin successfully', () => {
      const plugin = createMockPlugin('node', 'Node.js');
      registry.register(plugin);

      expect(registry.has('node')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should throw when registering a duplicate plugin name', () => {
      const plugin1 = createMockPlugin('node');
      const plugin2 = createMockPlugin('node');

      registry.register(plugin1);

      expect(() => registry.register(plugin2)).toThrow('Plugin "node" is already registered');
    });

    it('should register multiple plugins with different names', () => {
      registry.register(createMockPlugin('node'));
      registry.register(createMockPlugin('mysql'));
      registry.register(createMockPlugin('docker'));

      expect(registry.size).toBe(3);
    });
  });

  describe('get', () => {
    it('should return the plugin by name', () => {
      const plugin = createMockPlugin('node', 'Node.js');
      registry.register(plugin);

      const result = registry.get('node');

      expect(result).toBeDefined();
      expect(result?.name).toBe('node');
      expect(result?.displayName).toBe('Node.js');
    });

    it('should return undefined for unregistered plugins', () => {
      const result = registry.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered plugins', () => {
      registry.register(createMockPlugin('node'));
      expect(registry.has('node')).toBe(true);
    });

    it('should return false for unregistered plugins', () => {
      expect(registry.has('node')).toBe(false);
    });
  });

  describe('list', () => {
    it('should return an empty array when no plugins are registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all registered plugins', () => {
      registry.register(createMockPlugin('node'));
      registry.register(createMockPlugin('mysql'));

      const plugins = registry.list();

      expect(plugins).toHaveLength(2);
      expect(plugins.map((p) => p.name)).toContain('node');
      expect(plugins.map((p) => p.name)).toContain('mysql');
    });
  });

  describe('getNames', () => {
    it('should return plugin names', () => {
      registry.register(createMockPlugin('node'));
      registry.register(createMockPlugin('mysql'));

      const names = registry.getNames();

      expect(names).toContain('node');
      expect(names).toContain('mysql');
    });
  });
});
