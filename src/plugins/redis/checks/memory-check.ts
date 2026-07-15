import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

/** Warn when used memory exceeds this fraction of maxmemory (when configured). */
const MEMORY_WARN_THRESHOLD = 0.85;

export async function checkRedisMemory(port = 6379): Promise<DiagnosticCheck> {
  const result = await runCommand('redis-cli', ['-p', String(port), 'INFO', 'memory'], {
    timeoutMs: 5_000,
  });

  if (!result.success || !result.stdout) {
    return {
      name: 'redis-memory',
      label: 'Redis Memory Usage',
      status: 'skip',
      message: 'Could not retrieve Redis memory info (Redis may not be running).',
      dependsOn: ['redis-ping'],
    };
  }

  const lines = result.stdout.split('\n');
  const get = (key: string): string | undefined =>
    lines
      .find((l) => l.startsWith(key + ':'))
      ?.split(':')[1]
      ?.trim();

  const usedBytes = parseInt(get('used_memory') ?? '0', 10);
  const maxMemoryBytes = parseInt(get('maxmemory') ?? '0', 10);
  const usedHuman = get('used_memory_human') ?? `${Math.round(usedBytes / 1024 / 1024)}MB`;
  const maxHuman = get('maxmemory_human') ?? 'unlimited';

  // No maxmemory set — just report current usage, no threshold to warn on
  if (maxMemoryBytes === 0) {
    return {
      name: 'redis-memory',
      label: 'Redis Memory Usage',
      status: 'pass',
      message: `Redis is using ${usedHuman} (no maxmemory limit configured).`,
      detail:
        'Redis is currently using memory without an upper bound. For production ' +
        'environments, setting maxmemory with an appropriate eviction policy ' +
        '(e.g. allkeys-lru) is strongly recommended to prevent Redis from consuming ' +
        'all available system memory.',
      dependsOn: ['redis-ping'],
    };
  }

  const usageRatio = usedBytes / maxMemoryBytes;
  const usagePct = Math.round(usageRatio * 100);

  if (usageRatio >= MEMORY_WARN_THRESHOLD) {
    return {
      name: 'redis-memory',
      label: 'Redis Memory Usage',
      status: 'warn',
      message: `Redis is using ${usagePct}% of its ${maxHuman} limit (${usedHuman} used).`,
      detail:
        `Redis memory usage is at ${usagePct}%, approaching the configured maxmemory of ${maxHuman}. ` +
        'When Redis hits maxmemory, it will evict keys (or reject writes) depending on the ' +
        'configured eviction policy. High memory usage can degrade cache hit rates.',
      suggestion:
        'Options to address high Redis memory usage:\n' +
        '1. Increase maxmemory in redis.conf\n' +
        '2. Flush expired/unnecessary keys: redis-cli FLUSHDB (caution: destructive)\n' +
        '3. Review your eviction policy: redis-cli CONFIG GET maxmemory-policy\n' +
        '4. Analyse large keys: redis-cli --memkeys',
      dependsOn: ['redis-ping'],
    };
  }

  return {
    name: 'redis-memory',
    label: 'Redis Memory Usage',
    status: 'pass',
    message: `Redis is using ${usagePct}% of its ${maxHuman} limit (${usedHuman} used).`,
    detail: `Memory usage is healthy at ${usagePct}% of the configured ${maxHuman} maxmemory limit.`,
    dependsOn: ['redis-ping'],
  };
}
