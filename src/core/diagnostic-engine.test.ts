/**
 * Diagnostic Engine Tests
 *
 * Tests for the orchestration logic in the diagnostic engine.
 * Uses mock plugins to test the engine in isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiagnosticEngine } from '../core/engine/diagnostic-engine.js';
import { PluginRegistry } from '../plugins/plugin-registry.js';
import type { Plugin } from '../core/types/plugin.js';
import type { DiagnosticResult } from '../core/types/diagnostic.js';

function createSuccessPlugin(name: string): Plugin {
  return {
    name,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    description: `Test ${name} plugin`,
    async diagnose(): Promise<DiagnosticResult> {
      return {
        pluginName: name,
        displayName: name,
        timestamp: new Date(),
        durationMs: 5,
        checks: [
          {
            name: `${name}-check`,
            label: `${name} Check`,
            status: 'pass',
            message: `${name} is healthy.`,
          },
        ],
        overallStatus: 'pass',
      };
    },
  };
}

function createFailingPlugin(name: string): Plugin {
  return {
    name,
    displayName: name,
    description: `Failing ${name} plugin`,
    async diagnose(): Promise<DiagnosticResult> {
      throw new Error('Unexpected plugin error');
    },
  };
}

describe('DiagnosticEngine', () => {
  let registry: PluginRegistry;
  let engine: DiagnosticEngine;

  beforeEach(() => {
    registry = new PluginRegistry();
    engine = new DiagnosticEngine(registry);
  });

  describe('runDiagnostics', () => {
    it('should return results for a registered plugin', async () => {
      registry.register(createSuccessPlugin('node'));

      const result = await engine.runDiagnostics('node');

      expect(result).not.toBeNull();
      expect(result?.pluginName).toBe('node');
      expect(result?.overallStatus).toBe('pass');
      expect(result?.checks).toHaveLength(1);
    });

    it('should return null for an unregistered plugin', async () => {
      const result = await engine.runDiagnostics('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle plugin errors gracefully', async () => {
      registry.register(createFailingPlugin('broken'));

      const result = await engine.runDiagnostics('broken');

      expect(result).not.toBeNull();
      expect(result?.overallStatus).toBe('fail');
      expect(result?.checks[0].name).toBe('plugin-error');
      expect(result?.checks[0].message).toContain('unexpected error');
    });
  });

  describe('runAll', () => {
    it('should return results for all registered plugins', async () => {
      registry.register(createSuccessPlugin('node'));
      registry.register(createSuccessPlugin('mysql'));

      const results = await engine.runAll();

      expect(results).toHaveLength(2);
    });

    it('should return an empty array when no plugins are registered', async () => {
      const results = await engine.runAll();
      expect(results).toEqual([]);
    });
  });

  describe('getAvailablePlugins', () => {
    it('should return the names of all registered plugins', () => {
      registry.register(createSuccessPlugin('node'));
      registry.register(createSuccessPlugin('mysql'));

      const names = engine.getAvailablePlugins();

      expect(names).toContain('node');
      expect(names).toContain('mysql');
    });
  });
});
