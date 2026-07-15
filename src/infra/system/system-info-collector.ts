/**
 * System Information Collector
 *
 * Gathers operating system and runtime environment information
 * using Node.js built-in `os` module.
 *
 * This powers the `devdoctor info` command, giving developers
 * a quick snapshot of their system without needing to remember
 * platform-specific commands like `systeminfo` (Windows),
 * `uname -a` (Linux), or `sw_vers` (macOS).
 *
 * Architecture note:
 * This lives in the Infrastructure layer because it directly
 * accesses OS APIs. The types it returns (SystemInfo) are
 * defined in the Core layer.
 */

import os from 'node:os';
import type { SystemInfo } from '../../core/types/system-info.js';
import { runCommand } from '../os/command-runner.js';
import { detectTools } from './tool-detector.js';

/**
 * Human-readable OS name mapping.
 * Node's os.platform() returns short identifiers — we make them friendly.
 */
function getOsName(platform: string, release: string): string {
  switch (platform) {
    case 'win32': {
      // Windows release strings map to product versions
      if (release.startsWith('10.0.2')) return `Windows 11 (${release})`;
      if (release.startsWith('10.0')) return `Windows 10 (${release})`;
      return `Windows (${release})`;
    }
    case 'darwin':
      return `macOS (${release})`;
    case 'linux':
      return `Linux (${release})`;
    default:
      return `${platform} (${release})`;
  }
}

/**
 * Format bytes into a human-readable string.
 *
 * @example
 * formatBytes(1073741824) // "1.00 GB"
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format seconds into a human-readable uptime string.
 *
 * @example
 * formatUptime(90061) // "1d 1h 1m 1s"
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Collect comprehensive system information.
 *
 * @returns A SystemInfo object with OS, CPU, memory, runtime, and tool details
 */
export async function collectSystemInfo(): Promise<SystemInfo> {
  const platform = os.platform();
  const release = os.release();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();

  // Run npm version check and tool detection concurrently
  const [npmResult, tools] = await Promise.all([runCommand('npm', ['--version']), detectTools()]);

  const npmVersion = npmResult.success ? npmResult.stdout : undefined;

  return {
    os: {
      platform,
      name: getOsName(platform, release),
      version: release,
      architecture: os.arch(),
      uptimeSeconds: os.uptime(),
    },
    cpu: {
      model: cpus.length > 0 ? cpus[0].model : 'Unknown',
      cores: cpus.length,
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem,
      usagePercent: Math.round((usedMem / totalMem) * 100),
    },
    runtime: {
      nodeVersion: process.version,
      npmVersion,
      cwd: process.cwd(),
      homeDir: os.homedir(),
    },
    tools,
  };
}
