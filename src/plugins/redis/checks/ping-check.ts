import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export async function checkRedisPing(port = 6379): Promise<DiagnosticCheck> {
  const result = await runCommand('redis-cli', ['-p', String(port), 'ping'], { timeoutMs: 5_000 });

  if (result.success && result.stdout.trim().toUpperCase() === 'PONG') {
    return {
      name: 'redis-ping',
      label: 'Redis Connectivity',
      status: 'pass',
      message: `Redis responded to PING on port ${port}.`,
      detail:
        'The redis-cli PING command sends a simple heartbeat to the server. ' +
        'A PONG response confirms Redis is running and accepting connections.',
      dependsOn: ['redis-installation', 'redis-port'],
    };
  }

  return {
    name: 'redis-ping',
    label: 'Redis Connectivity',
    status: 'fail',
    message: `Redis did not respond to PING on port ${port}.`,
    detail:
      'The redis-cli PING command failed, which means Redis is either not running, ' +
      'bound to a different address, protected by a password (requirepass), or ' +
      'blocked by a firewall rule.',
    suggestion:
      'Check Redis is running: redis-cli ping\n' +
      'If password-protected: redis-cli -a <password> ping\n' +
      'Check Redis config: grep "^requirepass" /etc/redis/redis.conf',
    dependsOn: ['redis-installation', 'redis-port'],
  };
}
