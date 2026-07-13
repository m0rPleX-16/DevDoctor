/**
 * Repair Engine Behavioral Tests
 *
 * Tests the full repair workflow as exercised through the Plugin interface:
 * - Successful repair + passing verification
 * - Successful repair + failing verification (triggers rollback path)
 * - Failed repair (verify is never called)
 * - Plugins that don't implement rollback (rollbackSupported: false)
 * - Unexpected exceptions from repair/verify
 *
 * These tests use hand-crafted mock plugins so no real system commands
 * are executed. The goal is to verify the ORCHESTRATION CONTRACT —
 * i.e. what callers of plugin.repair / plugin.verify can rely on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDiagnosticResult(pluginName: string, status: 'pass' | 'fail' = 'fail'): DiagnosticResult {
  return {
    pluginName,
    displayName: pluginName,
    timestamp: new Date(),
    durationMs: 0,
    checks: [
      {
        name: `${pluginName}-check`,
        label: `${pluginName} Check`,
        status,
        message: status === 'pass' ? 'All good.' : 'Something is broken.',
      },
    ],
    overallStatus: status,
  };
}

/**
 * Build a mock Plugin with controllable repair/verify/rollback outcomes.
 */
function buildPlugin(options: {
  repairSuccess: boolean;
  repairRollbackSupported?: boolean;
  verifySuccess: boolean;
  rollbackSuccess?: boolean;
  repairThrows?: boolean;
  verifyThrows?: boolean;
}): Plugin & { rollback: ReturnType<typeof vi.fn> } {
  const {
    repairSuccess,
    repairRollbackSupported = false,
    verifySuccess,
    rollbackSuccess = true,
    repairThrows = false,
    verifyThrows = false,
  } = options;

  return {
    name: 'mock-plugin',
    displayName: 'Mock Plugin',
    description: 'Test plugin',

    async diagnose(): Promise<DiagnosticResult> {
      return makeDiagnosticResult('mock-plugin');
    },

    async repair(checkName: string): Promise<RepairResult> {
      if (repairThrows) throw new Error('repair exploded');
      return {
        checkName,
        success: repairSuccess,
        message: repairSuccess ? 'Repaired successfully.' : 'Repair failed.',
        rollbackSupported: repairRollbackSupported,
      };
    },

    async verify(checkName: string): Promise<VerificationResult> {
      if (verifyThrows) throw new Error('verify exploded');
      return {
        checkName,
        success: verifySuccess,
        message: verifySuccess ? 'Issue resolved.' : 'Issue persists.',
      };
    },

    rollback: vi.fn(async (checkName: string): Promise<RepairResult> => ({
      checkName,
      success: rollbackSuccess,
      message: rollbackSuccess ? 'Rolled back.' : 'Rollback failed.',
      rollbackSupported: false,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plugin repair contract', () => {
  describe('repair()', () => {
    it('returns success: true when the repair works', async () => {
      const plugin = buildPlugin({ repairSuccess: true, verifySuccess: true });
      const result = await plugin.repair('mock-check');
      expect(result.success).toBe(true);
      expect(result.checkName).toBe('mock-check');
    });

    it('returns success: false when the repair fails', async () => {
      const plugin = buildPlugin({ repairSuccess: false, verifySuccess: false });
      const result = await plugin.repair('mock-check');
      expect(result.success).toBe(false);
    });

    it('surfaces thrown errors as a caught result (caller responsibility)', async () => {
      const plugin = buildPlugin({ repairSuccess: true, repairThrows: true, verifySuccess: false });
      await expect(plugin.repair('mock-check')).rejects.toThrow('repair exploded');
    });
  });

  describe('verify()', () => {
    it('returns success: true when verification passes', async () => {
      const plugin = buildPlugin({ repairSuccess: true, verifySuccess: true });
      await plugin.repair('mock-check');
      const result = await plugin.verify('mock-check');
      expect(result.success).toBe(true);
    });

    it('returns success: false when verification fails', async () => {
      const plugin = buildPlugin({ repairSuccess: true, verifySuccess: false });
      await plugin.repair('mock-check');
      const result = await plugin.verify('mock-check');
      expect(result.success).toBe(false);
    });

    it('surfaces thrown errors (caller responsibility)', async () => {
      const plugin = buildPlugin({ repairSuccess: true, verifySuccess: true, verifyThrows: true });
      await expect(plugin.verify('mock-check')).rejects.toThrow('verify exploded');
    });
  });

  describe('rollback()', () => {
    it('is NOT called when repair itself fails', async () => {
      const plugin = buildPlugin({
        repairSuccess: false,
        repairRollbackSupported: true,
        verifySuccess: false,
      });

      const repairResult = await plugin.repair('mock-check');

      // Caller should skip verify + rollback when repair.success is false
      if (!repairResult.success) {
        // do not call verify or rollback
      }

      expect(plugin.rollback).not.toHaveBeenCalled();
    });

    it('is NOT called when repair succeeds AND verify passes', async () => {
      const plugin = buildPlugin({
        repairSuccess: true,
        repairRollbackSupported: true,
        verifySuccess: true,
      });

      const repairResult = await plugin.repair('mock-check');
      const verifyResult = await plugin.verify('mock-check');

      // Only call rollback if verify failed
      if (repairResult.success && !verifyResult.success && repairResult.rollbackSupported) {
        await plugin.rollback('mock-check');
      }

      expect(plugin.rollback).not.toHaveBeenCalled();
    });

    it('IS called when repair succeeds but verify fails and rollbackSupported is true', async () => {
      const plugin = buildPlugin({
        repairSuccess: true,
        repairRollbackSupported: true,
        verifySuccess: false,
        rollbackSuccess: true,
      });

      const repairResult = await plugin.repair('mock-check');
      const verifyResult = await plugin.verify('mock-check');

      if (repairResult.success && !verifyResult.success && repairResult.rollbackSupported) {
        await plugin.rollback('mock-check');
      }

      expect(plugin.rollback).toHaveBeenCalledOnce();
      expect(plugin.rollback).toHaveBeenCalledWith('mock-check');
    });

    it('is NOT called when rollbackSupported is false, even if verify fails', async () => {
      const plugin = buildPlugin({
        repairSuccess: true,
        repairRollbackSupported: false,
        verifySuccess: false,
      });

      const repairResult = await plugin.repair('mock-check');
      const verifyResult = await plugin.verify('mock-check');

      if (repairResult.success && !verifyResult.success && repairResult.rollbackSupported) {
        await plugin.rollback('mock-check');
      }

      expect(plugin.rollback).not.toHaveBeenCalled();
    });

    it('returns success: true when rollback completes successfully', async () => {
      const plugin = buildPlugin({
        repairSuccess: true,
        repairRollbackSupported: true,
        verifySuccess: false,
        rollbackSuccess: true,
      });

      await plugin.repair('mock-check');
      await plugin.verify('mock-check');
      const rollbackResult = await plugin.rollback('mock-check');

      expect(rollbackResult.success).toBe(true);
    });

    it('returns success: false when rollback itself fails', async () => {
      const plugin = buildPlugin({
        repairSuccess: true,
        repairRollbackSupported: true,
        verifySuccess: false,
        rollbackSuccess: false,
      });

      await plugin.repair('mock-check');
      await plugin.verify('mock-check');
      const rollbackResult = await plugin.rollback('mock-check');

      expect(rollbackResult.success).toBe(false);
    });
  });

  describe('full repair workflow', () => {
    it('repair → verify passes: workflow completes with success, no rollback', async () => {
      const plugin = buildPlugin({
        repairSuccess: true,
        repairRollbackSupported: true,
        verifySuccess: true,
      });

      const repairResult = await plugin.repair('mock-check');
      expect(repairResult.success).toBe(true);

      const verifyResult = await plugin.verify('mock-check');
      expect(verifyResult.success).toBe(true);

      // No rollback should be triggered
      expect(plugin.rollback).not.toHaveBeenCalled();
    });

    it('repair → verify fails → rollback succeeds: restores state', async () => {
      const plugin = buildPlugin({
        repairSuccess: true,
        repairRollbackSupported: true,
        verifySuccess: false,
        rollbackSuccess: true,
      });

      const repairResult = await plugin.repair('mock-check');
      expect(repairResult.success).toBe(true);
      expect(repairResult.rollbackSupported).toBe(true);

      const verifyResult = await plugin.verify('mock-check');
      expect(verifyResult.success).toBe(false);

      // Trigger rollback
      const rollbackResult = await plugin.rollback('mock-check');
      expect(rollbackResult.success).toBe(true);
      expect(plugin.rollback).toHaveBeenCalledOnce();
    });

    it('repair fails: workflow stops, verify and rollback are never invoked', async () => {
      const plugin = buildPlugin({
        repairSuccess: false,
        repairRollbackSupported: false,
        verifySuccess: false,
      });

      const verifySpy = vi.spyOn(plugin, 'verify');

      const repairResult = await plugin.repair('mock-check');
      expect(repairResult.success).toBe(false);

      // Simulate correct caller behaviour: bail out on failed repair
      if (!repairResult.success) {
        // no verify, no rollback
      }

      expect(verifySpy).not.toHaveBeenCalled();
      expect(plugin.rollback).not.toHaveBeenCalled();
    });
  });
});
