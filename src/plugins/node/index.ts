/**
 * Node.js Plugin
 *
 * The first plugin for Dev Doctor — serves as the proof of concept
 * for the entire plugin architecture.
 *
 * This plugin diagnoses the Node.js development environment by running
 * several checks: Node.js installation, npm availability, and PATH
 * configuration.
 *
 * Architecture note:
 * This is a concrete implementation of the Plugin interface.
 * It lives in the Plugins layer, which depends on Core (for types)
 * and Infrastructure (for command execution).
 * The Core layer never references this file directly — it only
 * knows about the Plugin interface.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkNodeVersion } from './checks/version-check.js';
import { checkNpm } from './checks/npm-check.js';
import { checkNodePath } from './checks/path-check.js';
import { checkNodePermissions } from './checks/permissions-check.js';
import { runCommand } from '../../infra/os/command-runner.js';

/**
 * Node.js Plugin
 *
 * Checks:
 * 1. Node.js installation and version
 * 2. npm installation and version
 * 3. PATH configuration
 * 4. npm global permissions
 */
export class NodePlugin implements Plugin {
  readonly name = 'node';
  readonly displayName = 'Node.js';
  readonly description = 'Diagnoses your Node.js development environment.';
  readonly projectMarkers = ['package.json', '.nvmrc', '.node-version', 'node_modules'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'node-version',
        label: 'Node.js Installation',
        run: checkNodeVersion,
      },
      {
        name: 'npm-version',
        label: 'npm Installation',
        dependsOn: ['node-version'],
        run: checkNpm,
      },
      {
        name: 'node-path',
        label: 'Node.js PATH',
        dependsOn: ['node-version'],
        run: checkNodePath,
      },
      {
        name: 'node-permissions',
        label: 'npm Permissions',
        dependsOn: ['node-version', 'npm-version'],
        run: checkNodePermissions,
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

  canRepair(checkName: string): boolean {
    return checkName === 'node-permissions';
  }

  async repair(checkName: string): Promise<RepairResult> {
    if (checkName === 'node-permissions') {
      try {
        const isWindows = process.platform === 'win32';

        // Guard: if the user has nvm installed, changing the npm prefix breaks
        // nvm's version management. Detect nvm and bail with a targeted suggestion
        // instead of silently corrupting their setup.
        const nvmDir = process.env.NVM_DIR;
        const nvmExists = nvmDir
          ? fs.existsSync(nvmDir)
          : fs.existsSync(path.join(os.homedir(), '.nvm'));
        const nvmWindowsExists = isWindows && (
          fs.existsSync(path.join(os.homedir(), 'AppData', 'Roaming', 'nvm')) ||
          fs.existsSync('C:\\nvm') ||
          !!process.env.NVM_HOME
        );

        if (nvmExists || nvmWindowsExists) {
          return {
            checkName,
            success: false,
            message: 'nvm detected — changing the npm prefix would break nvm\'s version management.',
            detail:
              'nvm stores global packages per Node version inside ~/.nvm. Setting a custom ' +
              'npm prefix in .npmrc conflicts with this and causes `nvm use` to fail.\n' +
              'The correct fix with nvm is to ensure Node was installed via nvm itself ' +
              '(not a system package manager), which makes the prefix user-writable automatically.',
            rollbackSupported: false,
          };
        }

        // 1. Get current prefix so we can support rollback
        const currentPrefixResult = await runCommand('npm', ['config', 'get', 'prefix']);
        const oldPrefix = currentPrefixResult.success ? currentPrefixResult.stdout.trim() : undefined;

        if (oldPrefix) {
          const auditDir = path.join(os.homedir(), '.devdoctor');
          if (!fs.existsSync(auditDir)) {
            fs.mkdirSync(auditDir, { recursive: true });
          }
          fs.writeFileSync(path.join(auditDir, 'npm-rollback-prefix.txt'), oldPrefix, 'utf-8');
        }

        // 2. Resolve target prefix
        let targetPrefix: string;
        if (isWindows) {
          const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
          targetPrefix = path.join(appData, 'npm-global');
        } else {
          targetPrefix = path.join(os.homedir(), '.npm-global');
        }

        // 3. Create target directory
        if (!fs.existsSync(targetPrefix)) {
          fs.mkdirSync(targetPrefix, { recursive: true });
        }

        // 4. Set prefix in npm config
        const setPrefixResult = await runCommand('npm', ['config', 'set', 'prefix', targetPrefix]);
        if (!setPrefixResult.success) {
          return {
            checkName,
            success: false,
            message: `Failed to set npm global prefix to "${targetPrefix}".`,
            detail: setPrefixResult.stderr,
            rollbackSupported: false,
          };
        }

        return {
          checkName,
          success: true,
          message: `Successfully changed npm global prefix to "${targetPrefix}".`,
          detail:
            `Old prefix: ${oldPrefix || 'unknown'}.\n` +
            `New prefix: ${targetPrefix}\n\n` +
            `⚠ Important: Add "${path.join(targetPrefix, 'bin')}" to your PATH so globally ` +
            `installed commands are accessible:\n` +
            (isWindows
              ? `  Open System Properties → Environment Variables → Path → New → paste the path above.`
              : `  Add this line to your ~/.bashrc or ~/.zshrc:\n` +
                `  export PATH="${path.join(targetPrefix, 'bin')}:$PATH"\n` +
                `  Then run: source ~/.bashrc`),
          rollbackSupported: !!oldPrefix,
        };
      } catch (err) {
        return {
          checkName,
          success: false,
          message: `Unexpected error during repair: ${err instanceof Error ? err.message : String(err)}`,
          rollbackSupported: false,
        };
      }
    }

    return {
      checkName,
      success: false,
      message: `NodePlugin does not support automated repairs for "${checkName}".`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    if (checkName === 'node-permissions') {
      const checkResult = await checkNodePermissions();
      return {
        checkName,
        success: checkResult.status === 'pass',
        message: checkResult.message,
      };
    }

    return {
      checkName,
      success: false,
      message: `Verification for "${checkName}" is not supported.`,
    };
  }

  async rollback(checkName: string): Promise<RepairResult> {
    if (checkName === 'node-permissions') {
      try {
        const rollbackFilePath = path.join(os.homedir(), '.devdoctor', 'npm-rollback-prefix.txt');
        if (!fs.existsSync(rollbackFilePath)) {
          return {
            checkName,
            success: false,
            message: 'No previous npm prefix was recorded to roll back to.',
            rollbackSupported: false,
          };
        }

        const oldPrefix = fs.readFileSync(rollbackFilePath, 'utf-8').trim();
        const setPrefixResult = await runCommand('npm', ['config', 'set', 'prefix', oldPrefix]);

        if (!setPrefixResult.success) {
          return {
            checkName,
            success: false,
            message: `Failed to restore npm global prefix to "${oldPrefix}".`,
            detail: setPrefixResult.stderr,
            rollbackSupported: false,
          };
        }

        fs.unlinkSync(rollbackFilePath);

        return {
          checkName,
          success: true,
          message: `Successfully rolled back npm global prefix to "${oldPrefix}".`,
          rollbackSupported: false,
        };
      } catch (err) {
        return {
          checkName,
          success: false,
          message: `Unexpected error during rollback: ${err instanceof Error ? err.message : String(err)}`,
          rollbackSupported: false,
        };
      }
    }

    return {
      checkName,
      success: false,
      message: `Rollback is not supported for "${checkName}".`,
      rollbackSupported: false,
    };
  }
}
