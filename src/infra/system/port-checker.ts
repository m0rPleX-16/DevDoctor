/**
 * Port Checker
 *
 * Identifies process occupying a TCP port.
 */

import type { PortOwner } from '../../core/types/port.js';
import { runCommand } from '../os/command-runner.js';

/**
 * Resolves PID to process name on Windows using `tasklist`
 */
async function getWindowsProcessName(pid: number): Promise<string | undefined> {
  const result = await runCommand('tasklist', ['/fi', `PID eq ${pid}`, '/nh']);
  if (!result.success) return undefined;

  // tasklist outputs: "mysqld.exe                   1234 Services                   0     45,212 K"
  const tokens = result.stdout.trim().split(/\s+/);
  if (tokens.length > 0 && tokens[0] !== 'No' && tokens[0] !== '') {
    return tokens[0];
  }
  return undefined;
}

/**
 * Checks TCP port owner on Windows using `netstat -ano -p tcp`
 */
async function checkWindowsPort(port: number): Promise<PortOwner | null> {
  const result = await runCommand('netstat', ['-ano', '-p', 'tcp']);
  if (!result.success) return null;

  // Search for port local address: e.g. "0.0.0.0:3306" or "[::]:3306"
  const lines = result.stdout.split('\n');
  const portPattern = new RegExp(`[:\\]]${port}\\s+.*\\s+(\\d+)\\s*$`);

  for (const line of lines) {
    const match = line.trim().match(portPattern);
    if (match) {
      const pid = parseInt(match[1], 10);
      if (!isNaN(pid) && pid > 0) {
        const processName = await getWindowsProcessName(pid);
        return { pid, processName: processName ?? 'Unknown' };
      }
    }
  }

  return null;
}

/**
 * Checks TCP port owner on Unix using `lsof -i :<port>`
 */
async function checkUnixPort(port: number): Promise<PortOwner | null> {
  const result = await runCommand('lsof', ['-i', `:${port}`, '-t']);
  if (result.success && result.stdout) {
    const pid = parseInt(result.stdout.trim().split('\n')[0], 10);
    if (!isNaN(pid)) {
      const nameResult = await runCommand('ps', ['-p', String(pid), '-o', 'comm=']);
      return {
        pid,
        processName: nameResult.success ? nameResult.stdout.trim() : 'Unknown',
      };
    }
  }
  return null;
}

/**
 * Scan if a port is in use and locate the owning process.
 */
export async function getPortOwner(port: number): Promise<PortOwner | null> {
  const isWindows = process.platform === 'win32';
  try {
    if (isWindows) {
      return await checkWindowsPort(port);
    } else {
      return await checkUnixPort(port);
    }
  } catch {
    return null;
  }
}
