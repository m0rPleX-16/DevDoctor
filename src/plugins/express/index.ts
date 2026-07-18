import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from '../../core/types/plugin.js';
import type {
  DiagnosticResult,
  DiagnosticTask,
  DiagnosticCheck,
} from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkExpressNodeEnv } from './checks/node-env-check.js';
import { checkExpressPort } from './checks/port-check.js';
import { checkExpressDebugHygiene } from './checks/debug-hygiene-check.js';

export class ExpressPlugin implements Plugin {
  readonly name = 'express';
  readonly displayName = 'Express';
  readonly description = 'Diagnoses configuration settings for Express applications.';
  readonly category = 'framework';
  readonly projectMarkers = ['package.json'];

  private isExpressProject(): boolean {
    const cwd = process.cwd();
    const pkgPath = path.join(cwd, 'package.json');
    let hasPackageJsonExpress = false;

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        hasPackageJsonExpress = !!(pkg.dependencies?.express || pkg.devDependencies?.express);
      } catch {
        // ignore JSON parse errors
      }
    }

    if (hasPackageJsonExpress) return true;

    // Fallback 1: check node_modules directly
    const nodeModulesExpressPath = path.join(cwd, 'node_modules', 'express');
    if (fs.existsSync(nodeModulesExpressPath)) return true;

    // Fallback 2: check common entry points for express import
    const entryPoints = [
      'index.js',
      'app.js',
      'server.js',
      'src/index.js',
      'src/app.js',
      'src/server.js',
    ];
    for (const entry of entryPoints) {
      const entryPath = path.join(cwd, entry);
      if (fs.existsSync(entryPath)) {
        try {
          const content = fs.readFileSync(entryPath, 'utf-8');
          if (
            content.includes("require('express')") ||
            content.includes('require("express")') ||
            content.includes("from 'express'") ||
            content.includes('from "express"')
          ) {
            return true;
          }
        } catch {
          // ignore read errors
        }
      }
    }

    return false;
  }

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    if (!this.isExpressProject()) {
      const durationMs = Math.round(performance.now() - startTime);
      const skipCheck: DiagnosticCheck = {
        name: 'express-project',
        label: 'Express Project Detection',
        status: 'skip',
        message: 'No Express dependency found in package.json.',
      };
      return {
        pluginName: this.name,
        displayName: this.displayName,
        timestamp: new Date(),
        durationMs,
        checks: [skipCheck],
        overallStatus: 'skip',
      };
    }

    const tasks: DiagnosticTask[] = [
      {
        name: 'express-node-env',
        label: 'NODE_ENV Defined',
        run: checkExpressNodeEnv,
      },
      {
        name: 'express-port',
        label: 'PORT Defined',
        run: checkExpressPort,
      },
      {
        name: 'express-debug-hygiene',
        label: 'DEBUG Variable Hygiene',
        run: checkExpressDebugHygiene,
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

  canRepair(): boolean {
    return false;
  }

  async repair(checkName: string): Promise<RepairResult> {
    return {
      checkName,
      success: false,
      message: 'Express plugin does not support automated repairs.',
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
}
