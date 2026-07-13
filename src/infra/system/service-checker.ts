/**
 * Service Checker
 *
 * Checks system service status (Windows: sc query, Unix: systemctl/launchctl).
 */

import type { ServiceInfo, ServiceStatus } from '../../core/types/service.js';
import { runCommand } from '../os/command-runner.js';

/**
 * Query status of a service on Windows using `sc query <serviceName>`
 */
async function queryWindowsService(serviceName: string): Promise<ServiceInfo> {
  const result = await runCommand('sc', ['query', serviceName]);

  if (!result.success) {
    // If exitCode is 1060, the service is not installed on Windows
    if (result.stderr.includes('1060') || result.stdout.includes('1060')) {
      return { name: serviceName, status: 'not_installed' };
    }
    return { name: serviceName, status: 'unknown' };
  }

  const stdout = result.stdout;
  let status: ServiceStatus = 'unknown';
  let pid: number | undefined;

  // Extract STATE from output (e.g. "STATE              : 4  RUNNING")
  const stateMatch = stdout.match(/STATE\s*:\s*\d+\s+(\w+)/i);
  if (stateMatch) {
    const stateStr = stateMatch[1].toUpperCase();
    if (stateStr === 'RUNNING') {
      status = 'running';
    } else if (stateStr === 'STOPPED') {
      status = 'stopped';
    }
  }

  // Extract PID if available
  const pidMatch = stdout.match(/PID\s*:\s*(\d+)/i);
  if (pidMatch) {
    pid = parseInt(pidMatch[1], 10);
  }

  return { name: serviceName, status, pid };
}

/**
 * Query status of a service on Unix systems using systemctl
 */
async function queryUnixService(serviceName: string): Promise<ServiceInfo> {
  // Try systemctl first
  const result = await runCommand('systemctl', ['status', serviceName]);
  if (result.success) {
    const isRunning = result.stdout.includes('active (running)');
    return {
      name: serviceName,
      status: isRunning ? 'running' : 'stopped',
    };
  }

  if (result.stderr.includes('not-found') || result.stdout.includes('not-found')) {
    return { name: serviceName, status: 'not_installed' };
  }

  return { name: serviceName, status: 'unknown' };
}

/**
 * Check a service's details dynamically based on OS platform.
 */
export async function checkService(serviceName: string): Promise<ServiceInfo> {
  const isWindows = process.platform === 'win32';
  try {
    if (isWindows) {
      return await queryWindowsService(serviceName);
    } else {
      return await queryUnixService(serviceName);
    }
  } catch {
    return { name: serviceName, status: 'unknown' };
  }
}
