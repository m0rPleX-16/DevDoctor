/**
 * Repair Engine
 *
 * The orchestrator for all repair, verification, and rollback operations.
 * Mirrors the DiagnosticEngine in design — the CLI calls this, never
 * plugin.repair() directly.
 *
 * Why a dedicated engine? (ADR-0010)
 * Previously the fix command imported PluginRegistry and called plugin methods
 * directly. This meant any cross-cutting concerns (error wrapping, audit logging,
 * timeouts) only applied to diagnostics, not repairs. Moving repair orchestration
 * into the Core engine layer enables consistent handling for both paths.
 *
 * Architecture note:
 * This is part of the Core/Application layer. It coordinates use cases but
 * contains no technology-specific logic. It depends on:
 *   - PluginRegistry (Core)
 *   - IAuditLogger interface (defined in infra/audit, imported as an interface)
 *
 * The actual IAuditLogger implementation is injected at the Composition Root.
 */

import type { RepairResult, VerificationResult } from '../types/repair.js';
import type { PluginRegistry } from '../../plugins/plugin-registry.js';
import type { IAuditLogger } from '../../infra/audit/audit-logger.js';
import { nullAuditLogger } from '../../infra/audit/audit-logger.js';
import { SnapshotManager } from './snapshot-manager.js';

export class RepairEngine {
  private readonly snapshotManager: SnapshotManager;

  constructor(
    private readonly registry: PluginRegistry,
    private readonly auditLogger: IAuditLogger = nullAuditLogger,
    snapshotManager?: SnapshotManager,
  ) {
    this.snapshotManager = snapshotManager ?? new SnapshotManager();
  }

  /**
   * Attempt to repair a specific failed check on a plugin.
   *
   * Wraps plugin errors in a structured RepairResult rather than letting
   * them propagate — consistent with how DiagnosticEngine wraps diagnose() errors.
   *
   * @param pluginName - The plugin identifier (e.g., "mysql")
   * @param checkName  - The check to repair (e.g., "mysql-service")
   * @param dryRun     - If true, skip actual repair and return a synthetic success
   */
  async runRepair(
    pluginName: string,
    checkName: string,
    dryRun: boolean = false,
  ): Promise<RepairResult> {
    const plugin = this.registry.get(pluginName);

    if (!plugin) {
      return {
        checkName,
        success: false,
        message: `Plugin "${pluginName}" is not registered.`,
        rollbackSupported: false,
      };
    }

    if (dryRun) {
      const result: RepairResult = {
        checkName,
        success: true,
        message: `[Dry run] Would attempt repair for "${checkName}".`,
        rollbackSupported: false,
      };
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        plugin: pluginName,
        checkName,
        action: 'repair',
        success: true,
        message: result.message,
        dryRun: true,
      });
      return result;
    }

    let result: RepairResult;
    try {
      result = await plugin.repair(checkName);

      if (result.success && result.rollbackSupported) {
        this.snapshotManager.recordRepair(pluginName, checkName);
      }
    } catch (err) {
      result = {
        checkName,
        success: false,
        message: `Unexpected error during repair: ${err instanceof Error ? err.message : String(err)}`,
        rollbackSupported: false,
      };
    }

    this.auditLogger.log({
      timestamp: new Date().toISOString(),
      plugin: pluginName,
      checkName,
      action: 'repair',
      success: result.success,
      message: result.message,
      dryRun: false,
    });

    return result;
  }

  /**
   * Verify that a check is now passing after a repair.
   *
   * @param pluginName - The plugin identifier
   * @param checkName  - The check to verify
   * @param dryRun     - If true, skip actual verification
   */
  async runVerification(
    pluginName: string,
    checkName: string,
    dryRun: boolean = false,
  ): Promise<VerificationResult> {
    const plugin = this.registry.get(pluginName);

    if (!plugin) {
      return {
        checkName,
        success: false,
        message: `Plugin "${pluginName}" is not registered.`,
      };
    }

    if (dryRun) {
      const result: VerificationResult = {
        checkName,
        success: true,
        message: `[Dry run] Verification skipped.`,
      };
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        plugin: pluginName,
        checkName,
        action: 'verify',
        success: true,
        message: result.message,
        dryRun: true,
      });
      return result;
    }

    let result: VerificationResult;
    try {
      result = await plugin.verify(checkName);
    } catch (err) {
      result = {
        checkName,
        success: false,
        message: `Verification check crashed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    this.auditLogger.log({
      timestamp: new Date().toISOString(),
      plugin: pluginName,
      checkName,
      action: 'verify',
      success: result.success,
      message: result.message,
      dryRun: false,
    });

    return result;
  }

  /**
   * Roll back a repair that succeeded mechanically but whose verification failed.
   *
   * @param pluginName - The plugin identifier
   * @param checkName  - The check to roll back
   * @param dryRun     - If true, skip actual rollback
   */
  async runRollback(
    pluginName: string,
    checkName: string,
    dryRun: boolean = false,
  ): Promise<RepairResult> {
    const plugin = this.registry.get(pluginName);

    if (!plugin) {
      return {
        checkName,
        success: false,
        message: `Plugin "${pluginName}" is not registered.`,
        rollbackSupported: false,
      };
    }

    if (!plugin.rollback) {
      return {
        checkName,
        success: false,
        message: `Plugin "${plugin.displayName}" does not implement rollback.`,
        rollbackSupported: false,
      };
    }

    if (dryRun) {
      const result: RepairResult = {
        checkName,
        success: true,
        message: `[Dry run] Would attempt rollback for "${checkName}".`,
        rollbackSupported: false,
      };
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        plugin: pluginName,
        checkName,
        action: 'rollback',
        success: true,
        message: result.message,
        dryRun: true,
      });
      return result;
    }

    let result: RepairResult;
    try {
      result = await plugin.rollback(checkName);
    } catch (err) {
      result = {
        checkName,
        success: false,
        message: `Rollback crashed: ${err instanceof Error ? err.message : String(err)}`,
        rollbackSupported: false,
      };
    }

    this.auditLogger.log({
      timestamp: new Date().toISOString(),
      plugin: pluginName,
      checkName,
      action: 'rollback',
      success: result.success,
      message: result.message,
      dryRun: false,
    });

    return result;
  }

  /**
   * Roll back all repairs recorded in the latest snapshot.
   * Restores the system state to before the last repair session.
   *
   * @param dryRun - If true, skip actual rollback
   */
  async rollbackAll(dryRun: boolean = false): Promise<RepairResult[]> {
    const snapshot = this.snapshotManager.getLatestSnapshot();
    if (!snapshot || snapshot.repairs.length === 0) {
      return [];
    }

    const results: RepairResult[] = [];
    // Roll back in reverse order to unwind correctly
    for (let i = snapshot.repairs.length - 1; i >= 0; i--) {
      const record = snapshot.repairs[i];
      const result = await this.runRollback(record.plugin, record.checkName, dryRun);
      results.push(result);
    }

    if (!dryRun) {
      this.snapshotManager.clearSnapshot();
    }

    return results;
  }
}
