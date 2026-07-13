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

/**
 * The contract that every Dev Doctor plugin must implement.
 *
 * Phase 1: diagnose()
 * Phase 4: repair() and verify() will be added
 */
export interface Plugin {
  /** Unique identifier used in CLI commands (e.g., "node", "mysql") */
  name: string;

  /** Human-readable name for display (e.g., "Node.js", "MySQL") */
  displayName: string;

  /** Short description of what this plugin checks */
  description: string;

  /**
   * Run all diagnostic checks for this technology.
   *
   * Each plugin decides what checks are relevant.
   * For example, the Node.js plugin checks:
   * - Is Node.js installed?
   * - Is npm available?
   * - Is Node.js on the system PATH?
   *
   * @returns A structured diagnostic result with all check outcomes
   */
  diagnose(): Promise<DiagnosticResult>;
}
