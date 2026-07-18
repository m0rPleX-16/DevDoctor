/**
 * Redis Plugin
 *
 * Diagnoses a local Redis installation.
 *
 * Checks (in dependency order):
 *   1. redis-installation — redis-server binary present and on PATH
 *   2. redis-service      — system service running (depends on #1)
 *   3. redis-port         — port 6379 owned by Redis (depends on #1)
 *   4. redis-ping         — PING/PONG connectivity (depends on #1, #3)
 *   5. redis-memory       — memory usage vs maxmemory (depends on #4)
 *
 * Repair support:
 *   Redis repairs are intentionally limited. Starting a system service
 *   safely requires elevation and differs significantly across platforms
 *   (systemctl / WSL / XAMPP-style). The plugin surfaces clear suggestions
 *   rather than attempting potentially destructive automated repairs.
 */

import type { Plugin } from '../../core/types/plugin.js';
import type { DiagnosticResult, DiagnosticTask } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus } from '../../core/engine/status-utils.js';
import { runDiagnosticTasks } from '../../core/engine/check-runner.js';
import { checkRedisInstallation } from './checks/installation-check.js';
import { checkRedisService } from './checks/service-check.js';
import { checkRedisPort, REDIS_DEFAULT_PORT } from './checks/port-check.js';
import { checkRedisPing } from './checks/ping-check.js';
import { checkRedisMemory } from './checks/memory-check.js';

export class RedisPlugin implements Plugin {
  readonly name = 'redis';
  readonly displayName = 'Redis';
  readonly description = 'Diagnoses your Redis in-memory data store.';
  readonly category = 'database';
  readonly projectMarkers = ['redis.conf', 'docker-compose.yml', 'docker-compose.yaml', '.env'];

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    const tasks: DiagnosticTask[] = [
      {
        name: 'redis-installation',
        label: 'Redis Installation',
        run: checkRedisInstallation,
      },
      {
        name: 'redis-service',
        label: 'Redis Service',
        dependsOn: ['redis-installation'],
        run: checkRedisService,
      },
      {
        name: 'redis-port',
        label: `Redis Port (${REDIS_DEFAULT_PORT})`,
        dependsOn: ['redis-installation'],
        run: () => checkRedisPort(REDIS_DEFAULT_PORT),
      },
      {
        name: 'redis-ping',
        label: 'Redis Connectivity',
        dependsOn: ['redis-installation', 'redis-port'],
        run: () => checkRedisPing(REDIS_DEFAULT_PORT),
      },
      {
        name: 'redis-memory',
        label: 'Redis Memory',
        dependsOn: ['redis-ping'],
        run: () => checkRedisMemory(REDIS_DEFAULT_PORT),
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
      message: `RedisPlugin does not support automated repairs for "${checkName}". Please refer to the suggestion shown in the diagnostic output.`,
      rollbackSupported: false,
    };
  }

  async verify(checkName: string): Promise<VerificationResult> {
    return {
      checkName,
      success: false,
      message: `Verification for "${checkName}" is not supported by the Redis plugin.`,
    };
  }

  canRepair(_checkName: string): boolean {
    return false;
  }
}
