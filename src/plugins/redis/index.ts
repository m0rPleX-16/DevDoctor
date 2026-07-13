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
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { RepairResult, VerificationResult } from '../../core/types/repair.js';
import { deriveOverallStatus, applyDependencySkips } from '../../core/engine/status-utils.js';
import { checkRedisInstallation } from './checks/installation-check.js';
import { checkRedisService } from './checks/service-check.js';
import { checkRedisPort, REDIS_DEFAULT_PORT } from './checks/port-check.js';
import { checkRedisPing } from './checks/ping-check.js';
import { checkRedisMemory } from './checks/memory-check.js';

export class RedisPlugin implements Plugin {
  readonly name = 'redis';
  readonly displayName = 'Redis';
  readonly description = 'Diagnoses your Redis in-memory data store.';

  async diagnose(): Promise<DiagnosticResult> {
    const startTime = performance.now();

    // Step 1: installation — all other checks depend on this
    const installCheck = await checkRedisInstallation();

    // Steps 2-5: run concurrently once we know the binary exists
    // dependsOn fields will cause the engine to skip them if installation failed
    const [serviceCheck, portCheck, pingCheck, memoryCheck] = await Promise.all([
      checkRedisService(),
      checkRedisPort(REDIS_DEFAULT_PORT),
      checkRedisPing(REDIS_DEFAULT_PORT),
      checkRedisMemory(REDIS_DEFAULT_PORT),
    ]);

    // Apply dependency-aware skip resolution (ADR suggestion #7)
    const checks = applyDependencySkips([
      installCheck,
      serviceCheck,
      portCheck,
      pingCheck,
      memoryCheck,
    ]);

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
}
