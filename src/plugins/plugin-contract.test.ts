import { describe, it, expect } from 'vitest';
import type { Plugin } from '../core/types/plugin.js';
import { NodePlugin } from './node/index.js';
import { MysqlPlugin } from './mysql/index.js';
import { GitPlugin } from './git/index.js';

/**
 * Generic test suite to validate that any Plugin implementation
 * satisfies the expected contract.
 *
 * @param plugin - The Plugin instance to test
 */
export function testPluginContract(plugin: Plugin) {
  describe(`Plugin Contract: ${plugin.name}`, () => {
    it('has required metadata properties', () => {
      expect(typeof plugin.name).toBe('string');
      expect(plugin.name.length).toBeGreaterThan(0);
      expect(typeof plugin.displayName).toBe('string');
      expect(plugin.displayName.length).toBeGreaterThan(0);
      expect(typeof plugin.description).toBe('string');
      expect(plugin.description.length).toBeGreaterThan(0);
    });

    it('returns a valid DiagnosticResult from diagnose()', async () => {
      const result = await plugin.diagnose();

      expect(result).toBeDefined();
      expect(result.pluginName).toBe(plugin.name);
      expect(result.displayName).toBe(plugin.displayName);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(['pass', 'fail', 'warn', 'skip']).toContain(result.overallStatus);

      expect(Array.isArray(result.checks)).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);

      for (const check of result.checks) {
        expect(typeof check.name).toBe('string');
        expect(typeof check.label).toBe('string');
        expect(['pass', 'fail', 'warn', 'skip']).toContain(check.status);
        expect(typeof check.message).toBe('string');
      }
    });

    it('returns a valid RepairResult from repair()', async () => {
      const checkName = 'non-existent-check';
      const result = await plugin.repair(checkName);

      expect(result).toBeDefined();
      expect(result.checkName).toBe(checkName);
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('returns a valid VerificationResult from verify()', async () => {
      const checkName = 'non-existent-check';
      const result = await plugin.verify(checkName);

      expect(result).toBeDefined();
      expect(result.checkName).toBe(checkName);
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });
}

// Run the contract tests for all built-in plugins
testPluginContract(new NodePlugin());
testPluginContract(new MysqlPlugin());
testPluginContract(new GitPlugin());
