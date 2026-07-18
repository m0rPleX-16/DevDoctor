/**
 * Plugin Interface
 *
 * This is the central contract of Dev Doctor's architecture.
 * Every supported technology (Node.js, MySQL, Docker, etc.) is implemented
 * as a plugin that conforms to this interface.
 *
 * Architecture note:
 * The core application never knows HOW a plugin performs its diagnostics.
 * It only knows THAT a plugin can diagnose, and later repair/verify.
 * This is the Dependency Inversion Principle (DIP) in action — the core
 * depends on abstractions (this interface), not concrete implementations.
 *
 * Design Pattern: Strategy Pattern
 * Each plugin is a different "strategy" for diagnosing a specific technology.
 * The diagnostic engine selects the right strategy based on the plugin name.
 */

import type { DiagnosticResult } from './diagnostic.js';
import type { RepairResult, VerificationResult } from './repair.js';

/**
 * The contract that every Dev Doctor plugin must implement.
 */
export interface Plugin {
  /** Unique identifier used in CLI commands (e.g., "node", "mysql") */
  name: string;

  /** Human-readable name for display (e.g., "Node.js", "MySQL") */
  displayName: string;

  /** short description of what this plugin checks */
  description: string;

  /** Category of this plugin (e.g. language, framework, database, tool) */
  category: 'language' | 'framework' | 'database' | 'tool';

  /**
   * File or directory names that indicate this plugin is relevant to the
   * current working directory. Used by `devdoctor doctor` to visually
   * distinguish plugins that are likely relevant to the project from those
   * that are not.
   *
   * Each entry is a filename or directory name checked for existence directly
   * inside process.cwd(). Any match marks the plugin as "detected".
   *
   * Examples:
   *   ['package.json', '.nvmrc', '.node-version']  → node
   *   ['.git']                                      → git
   *   ['requirements.txt', 'pyproject.toml']        → python
   */
  projectMarkers?: string[];

  /**
   * Run all diagnostic checks for this technology.
   */
  diagnose(): Promise<DiagnosticResult>;

  /**
   * Attempt to repair a specific failed check.
   */
  repair(checkName: string): Promise<RepairResult>;

  /**
   * Verify if a check is now passing after a repair.
   */
  verify(checkName: string): Promise<VerificationResult>;

  /**
   * Roll back a repair that succeeded mechanically but whose verification failed.
   * Only called when RepairResult.rollbackSupported is true.
   */
  rollback?(checkName: string): Promise<RepairResult>;

  /**
   * Return whether this plugin supports automated repair for a given check name.
   *
   * The fix command uses this to decide whether to offer a repair prompt for
   * a failed check. If not implemented, the fix command conservatively assumes
   * the plugin does not support repair for that check.
   *
   * This avoids prompting the user for repairs that would always return
   * "not supported", giving them a cleaner experience.
   */
  canRepair?(checkName: string): boolean;
}
