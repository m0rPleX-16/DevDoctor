import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkGitInstallation } from './checks/installation-check.js';
import { checkGitIdentity } from './checks/identity-check.js';
import { checkSshKeys } from './checks/ssh-check.js';
import { checkDefaultBranch } from './checks/branch-check.js';
import { checkCrlf } from './checks/crlf-check.js';
import { checkCredentialHelper } from './checks/credential-helper-check.js';

export class GitPlugin implements Plugin {
  readonly name = 'git';
  readonly displayName = 'Git';
  readonly description = 'Diagnoses Git installation and configuration.';
  readonly projectMarkers = ['.git', '.gitignore', '.gitattributes', '.github'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'git-installation',
        label: 'Git Installation',
        run: checkGitInstallation,
      },
      {
        name: 'git-identity',
        label: 'Git Identity',
        dependsOn: ['git-installation'],
        run: checkGitIdentity,
      },
      {
        name: 'git-default-branch',
        label: 'Default Branch Name',
        dependsOn: ['git-installation'],
        run: checkDefaultBranch,
      },
      {
        name: 'git-ssh',
        label: 'SSH Keys',
        dependsOn: ['git-installation'],
        run: checkSshKeys,
      },
      {
        name: 'git-crlf',
        label: 'Line Endings Config',
        dependsOn: ['git-installation'],
        run: checkCrlf,
      },
      {
        name: 'git-credential-helper',
        label: 'Credential Helper',
        dependsOn: ['git-installation'],
        run: checkCredentialHelper,
      },
    ];

    const checks = await runDiagnosticTasks(tasks);
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
