/**
 * System Information Types
 *
 * Types for the `devdoctor info` command.
 * Provides a structured view of the user's development environment.
 */

import type { DetectedTool } from './doctor-result.js';

/**
 * Comprehensive snapshot of the current system.
 */
export interface SystemInfo {
  /** Operating system details */
  os: OsInfo;

  /** CPU details */
  cpu: CpuInfo;

  /** Memory details */
  memory: MemoryInfo;

  /** Runtime environment details */
  runtime: RuntimeInfo;

  /** Detected development tools */
  tools: DetectedTool[];
}

export interface OsInfo {
  /** OS platform (e.g., "win32", "linux", "darwin") */
  platform: string;

  /** Human-readable OS name (e.g., "Windows 11", "Ubuntu 22.04") */
  name: string;

  /** OS version string */
  version: string;

  /** CPU architecture (e.g., "x64", "arm64") */
  architecture: string;

  /** System uptime in seconds */
  uptimeSeconds: number;
}

export interface CpuInfo {
  /** CPU model name */
  model: string;

  /** Number of logical CPU cores */
  cores: number;
}

export interface MemoryInfo {
  /** Total system memory in bytes */
  totalBytes: number;

  /** Free system memory in bytes */
  freeBytes: number;

  /** Used memory in bytes */
  usedBytes: number;

  /** Usage percentage (0-100) */
  usagePercent: number;
}

export interface RuntimeInfo {
  /** Node.js version (e.g., "v20.11.0") */
  nodeVersion: string;

  /** npm version if available */
  npmVersion?: string;

  /** Current working directory */
  cwd: string;

  /** User's home directory */
  homeDir: string;
}
