import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { checkGitInstallation } from './checks/installation-check.js';
import { checkGitIdentity } from './checks/identity-check.js';
import { checkSshKeys } from './checks/ssh-check.js';
import { checkDefaultBranch } from './checks/branch-check.js';

export class GitPlugin implements Plugin {
  readonly name = 'git';
  readonly displayName = 'Git';
  readonly description = 'Diagnoses Git installation and configuration.';

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    // Check installation first since others depend on it
    const installCheck = await checkGitInstallation();
    let checks = [installCheck];

    if (installCheck.status === 'pass') {
      const remainingChecks = await Promise.all([
        checkGitIdentity(),
        checkDefaultBranch(),
        checkSshKeys(),
      ]);
      checks = checks.concat(remainingChecks);
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      pluginName: this.name,
      displayName: this.displayName,
      timestamp: new Date(),
      durationMs,
      checks,
      overallStatus: deriveOverallStatus(checks.map((c) => c.status)),
    };
  }

  async repair(checkName: string): Promise<RepairResult> {
    return {
      checkName,
      success: false,
      message: `GitPlugin does not support automated repairs for "${checkName}".`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    return {
      checkName,
      success: false,
      message: `Verification for "${checkName}" is not supported.`,
    };
  }

  canRepair(_checkName: string): boolean {
    return false;
  }
}
