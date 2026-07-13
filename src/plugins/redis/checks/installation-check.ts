import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export async function checkRedisInstallation(): Promise<DiagnosticCheck> {
  const result = await runCommand('redis-server', ['--version']);

  if (!result.success) {
    return {
      name: 'redis-installation',
      label: 'Redis Installation',
      status: 'fail',
      message: 'Redis is not installed or not found on the system PATH.',
      detail:
        'Redis is an in-memory data store used as a database, cache, and message broker. ' +
        'Many web applications rely on Redis for session storage, rate limiting, queues, ' +
        'and caching. Without Redis installed, any service that depends on it will fail.',
      suggestion:
        'Install Redis for your platform:\n' +
        '  Windows: Use the Windows Subsystem for Linux (WSL) or download from https://github.com/microsoftarchive/redis/releases\n' +
        '  macOS:   brew install redis\n' +
        '  Linux:   sudo apt install redis-server  (Debian/Ubuntu)\n' +
        '           sudo yum install redis          (RHEL/CentOS)',
    };
  }

  // e.g. "Redis server v=7.2.4 sha=00000000:0 malloc=libc bits=64 build=..."
  const versionMatch = result.stdout.match(/v=(\S+)/);
  const version = versionMatch ? versionMatch[1] : result.stdout.trim();

  return {
    name: 'redis-installation',
    label: 'Redis Installation',
    status: 'pass',
    message: `Redis is installed (v${version}).`,
    detail: `Redis server version ${version} was detected on the system PATH.`,
  };
}
