/**
 * History Types
 *
 * Types for the `devdoctor history` command — diagnostic run snapshots
 * and health score trending over time.
 *
 * Architecture note:
 * Lives in the Core/Domain layer. Zero external dependencies.
 */

/**
 * A lightweight snapshot of a single `doctor` run, written to
 * ~/.devdoctor/runs.json (NDJSON) after each `devdoctor doctor` invocation.
 *
 * Kept intentionally small — only the data needed for trending.
 * Full diagnostic results are not stored to avoid large file growth.
 */
export interface HistoryEntry {
  /** ISO 8601 UTC timestamp of when the run completed */
  timestamp: string;

  /** Overall health percentage (0–100) */
  percentage: number;

  /** 'healthy' | 'degraded' | 'unhealthy' */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** Total checks run */
  totalChecks: number;

  /** Checks that passed */
  passedChecks: number;

  /** Checks that warned */
  warningChecks: number;

  /** Checks that failed */
  failedChecks: number;

  /** Duration of the full doctor run in ms */
  durationMs: number;

  /**
   * Plugin-level summary: name → overallStatus.
   * Lets the history view show which plugin degraded between runs.
   */
  pluginSummary: Record<string, 'pass' | 'warn' | 'fail' | 'skip'>;
}
