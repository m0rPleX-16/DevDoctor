/**
 * Doctor Result Types
 *
 * Types for the `devdoctor doctor` command — the full health dashboard.
 * Aggregates plugin diagnostics and tool detection into a single report.
 *
 * The doctor command is the "big picture" view of a developer's
 * environment health, unlike `diagnose` which focuses on one technology.
 */

import type { DiagnosticResult } from './diagnostic.js';

/**
 * Overall health status derived from the health score.
 *
 * - `healthy`   — 80-100% of checks passing
 * - `degraded`  — 50-79% of checks passing
 * - `unhealthy` — Below 50% of checks passing
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * A detected development tool with its status.
 */
export interface DetectedTool {
  /** Tool name (e.g., "Git", "Docker") */
  name: string;

  /** CLI command name (e.g., "git", "docker") */
  command: string;

  /** Version string if installed */
  version: string | undefined;

  /** Installation path if detected */
  path: string | undefined;

  /** Whether the tool is installed and accessible */
  installed: boolean;

  /** Category for grouping in display */
  category: 'runtime' | 'package-manager' | 'version-control' | 'container' | 'build-tool' | 'database';
}

/**
 * The health score for the overall environment.
 */
export interface HealthScore {
  /** Percentage of checks passing (0-100) */
  percentage: number;

  /** Derived health status */
  status: HealthStatus;

  /** Total number of checks run */
  totalChecks: number;

  /** Number of checks that passed */
  passedChecks: number;

  /** Number of warnings */
  warningChecks: number;

  /** Number of failures */
  failedChecks: number;
}

/**
 * The complete doctor result — the full health dashboard data.
 */
export interface DoctorResult {
  /** Results from all plugin diagnostics */
  diagnostics: DiagnosticResult[];

  /** All detected development tools */
  tools: DetectedTool[];

  /** Overall health score */
  health: HealthScore;

  /** When the doctor check was run */
  timestamp: Date;

  /** Total duration in milliseconds */
  durationMs: number;
}
