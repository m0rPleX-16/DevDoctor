/**
 * Diagnostic Types
 *
 * These types define the structure of diagnostic results throughout Dev Doctor.
 * Every plugin returns diagnostics in this format, ensuring consistent
 * rendering and reporting regardless of which technology is being checked.
 *
 * Architecture note:
 * These types live in the Core/Domain layer and have ZERO external dependencies.
 * They define the "language" of the application — all other layers depend on these,
 * but these types depend on nothing.
 */

/**
 * The outcome status of a single diagnostic check.
 *
 * - `pass`  — The check completed successfully, everything is healthy.
 * - `warn`  — The check found a potential issue that isn't critical.
 * - `fail`  — The check found a problem that needs attention.
 * - `skip`  — The check was skipped (e.g., not applicable on this OS).
 */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

/**
 * A single diagnostic check result.
 *
 * Each check answers one specific question about a tool or service.
 * For example: "Is Node.js installed?" or "Is port 3306 available?"
 */
export interface DiagnosticCheck {
  /** Short name identifying this check (e.g., "node-version") */
  name: string;

  /** Human-readable label shown in the terminal (e.g., "Node.js Version") */
  label: string;

  /** The outcome of this check */
  status: CheckStatus;

  /** A brief summary of what was found (e.g., "v20.11.0 detected") */
  message: string;

  /**
   * An educational explanation of what this check does and why it matters.
   * This is what makes Dev Doctor different from a simple status checker —
   * it teaches the user about their development environment.
   */
  detail?: string;

  /**
   * A recommended action if the check didn't pass.
   * Should be specific and actionable (e.g., "Run `nvm install 20` to install Node.js 20")
   */
  suggestion?: string;

  /**
   * Names of checks (by `name` field) that must have passed before this check
   * should run. If any dependency check did not pass, this check is automatically
   * skipped with a "skipped (dependency not met)" message.
   *
   * Example: a port check depends on the service installation check.
   * If MySQL is not installed, checking port 3306 produces a confusing false
   * negative. Declaring `dependsOn: ['mysql-service']` avoids that noise.
   */
  dependsOn?: string[];
}

/**
 * The complete diagnostic result for a single plugin.
 *
 * Contains metadata about the plugin that was checked,
 * along with all individual check results.
 */
export interface DiagnosticResult {
  /** The plugin identifier (e.g., "node", "mysql") */
  pluginName: string;

  /** Human-readable name (e.g., "Node.js", "MySQL") */
  displayName: string;

  /** When the diagnostic was run */
  timestamp: Date;

  /** How long the diagnostic took in milliseconds */
  durationMs: number;

  /** The individual check results */
  checks: DiagnosticCheck[];

  /** Overall summary — derived from the worst status among checks */
  overallStatus: CheckStatus;
}

/**
 * Defines a check to be executed by the CheckRunner.
 * Separating the definition from the result allows the engine to
 * build a dependency graph and prune skips before execution.
 */
export interface DiagnosticTask {
  /** The unique name of this check (must match the resulting DiagnosticCheck.name) */
  name: string;

  /** Human-readable label for the check (used for skip messages) */
  label: string;

  /** Names of checks that must pass before this check can run */
  dependsOn?: string[];

  /** The function that executes the check */
  run: () => Promise<DiagnosticCheck>;
}
