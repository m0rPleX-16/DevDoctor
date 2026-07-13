import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { getPortOwner } from '../../../infra/system/port-checker.js';

export const REDIS_DEFAULT_PORT = 6379;

export async function checkRedisPort(port = REDIS_DEFAULT_PORT): Promise<DiagnosticCheck> {
  const owner = await getPortOwner(port);

  if (!owner) {
    return {
      name: 'redis-port',
      label: `Redis Port (${port})`,
      status: 'warn',
      message: `Nothing is listening on port ${port}.`,
      detail:
        `Port ${port} is the standard Redis port. Nothing is bound to it, which means ` +
        'Redis is not running or is configured to listen on a non-standard port.',
      suggestion:
        `Start Redis and confirm it is listening: redis-cli ping\n` +
        `If using a custom port, update the port in redis.conf.`,
      dependsOn: ['redis-installation'],
    };
  }

  const isRedis =
    owner.processName.toLowerCase().includes('redis') ||
    owner.processName.toLowerCase().includes('redis-server');

  if (isRedis) {
    return {
      name: 'redis-port',
      label: `Redis Port (${port})`,
      status: 'pass',
      message: `Redis is listening on port ${port} (PID: ${owner.pid}).`,
      detail: `Process "${owner.processName}" (PID: ${owner.pid}) owns port ${port}.`,
      dependsOn: ['redis-installation'],
    };
  }

  return {
    name: 'redis-port',
    label: `Redis Port (${port})`,
    status: 'fail',
    message: `Port ${port} is occupied by "${owner.processName}" (PID: ${owner.pid}), not Redis.`,
    detail:
      `A non-Redis process is using port ${port}. Redis will fail to start until this ` +
      `port is freed. Killing the wrong process can cause data loss — investigate before acting.`,
    suggestion:
      `Identify the conflicting process and stop it cleanly, or reconfigure Redis to use a different port:\n` +
      `  Edit redis.conf: port 6380\n` +
      `  Connect with: redis-cli -p 6380`,
    dependsOn: ['redis-installation'],
  };
}
