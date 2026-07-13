import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { checkService } from '../../../infra/system/service-checker.js';

const REDIS_WINDOWS_SERVICES = ['Redis', 'redis'];
const REDIS_UNIX_SERVICES = ['redis', 'redis-server'];

export async function checkRedisService(): Promise<DiagnosticCheck> {
  const isWindows = process.platform === 'win32';
  const candidates = isWindows ? REDIS_WINDOWS_SERVICES : REDIS_UNIX_SERVICES;

  for (const name of candidates) {
    const info = await checkService(name);
    if (info.status === 'running') {
      return {
        name: 'redis-service',
        label: 'Redis Service',
        status: 'pass',
        message: `Redis service "${name}" is running.`,
        detail: `The "${name}" system service is active and accepting connections.`,
        dependsOn: ['redis-installation'],
      };
    }
    if (info.status === 'stopped') {
      return {
        name: 'redis-service',
        label: 'Redis Service',
        status: 'fail',
        message: `Redis service "${name}" is installed but not running.`,
        detail:
          'A stopped Redis service means any application trying to connect to Redis will ' +
          'receive a connection refused error. The service needs to be started.',
        suggestion: isWindows
          ? `Start the Redis service: net start ${name}\nOr use the Services panel (services.msc).`
          : `Start the Redis service: sudo systemctl start ${name}\nEnable on boot: sudo systemctl enable ${name}`,
        dependsOn: ['redis-installation'],
      };
    }
  }

  // No registered service found — Redis may be run manually or via WSL
  return {
    name: 'redis-service',
    label: 'Redis Service',
    status: 'warn',
    message: 'No registered Redis system service found.',
    detail:
      'Redis does not appear to be installed as a system service. ' +
      'It may be running as a standalone process, inside WSL, or in a container. ' +
      'The port check below will confirm whether Redis is actually reachable.',
    suggestion:
      'If you need Redis as a persistent background service, install it via your ' +
      'package manager and enable the service.',
    dependsOn: ['redis-installation'],
  };
}
