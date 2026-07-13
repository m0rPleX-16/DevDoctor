/**
 * Environment Types
 *
 * Types for the `devdoctor env` command.
 * Provides structured representations of environment variables
 * and PATH entries relevant to software development.
 *
 * Architecture note:
 * These types live in the Core/Domain layer with zero dependencies.
 * The infrastructure layer (env-scanner) populates these types,
 * and the CLI layer renders them.
 */

/**
 * Categories for grouping environment variables.
 *
 * Grouping makes it easier to scan a potentially long list of
 * variables and find the ones relevant to a specific technology.
 */
export type EnvCategory =
  | 'system'
  | 'node'
  | 'java'
  | 'python'
  | 'docker'
  | 'git'
  | 'other';

/**
 * Human-readable labels for each category.
 */
export const ENV_CATEGORY_LABELS: Record<EnvCategory, string> = {
  system: 'System',
  node: 'Node.js',
  java: 'Java',
  python: 'Python',
  docker: 'Docker',
  git: 'Git',
  other: 'Other',
};

/**
 * A single environment variable with metadata.
 */
export interface EnvVariable {
  /** The variable name (e.g., "JAVA_HOME") */
  name: string;

  /** The variable value, or undefined if not set */
  value: string | undefined;

  /** Which technology category this variable belongs to */
  category: EnvCategory;

  /**
   * Educational description of what this variable does.
   * This is what makes Dev Doctor's env command more useful
   * than just running `set` or `printenv`.
   */
  description: string;

  /** Whether this variable is considered important for its category */
  important: boolean;
}

/**
 * A single entry from the PATH environment variable.
 *
 * The PATH is one of the most important environment variables —
 * it tells the OS where to find executable programs. Understanding
 * PATH issues is critical for debugging "command not found" errors.
 */
export interface PathEntry {
  /** The directory path */
  path: string;

  /** The position in the PATH (0-indexed, lower = higher priority) */
  index: number;

  /** Whether the directory actually exists on disk */
  exists: boolean;
}

/**
 * The complete environment scan result.
 */
export interface EnvironmentInfo {
  /** Categorized environment variables */
  variables: EnvVariable[];

  /** Parsed PATH entries with validation */
  pathEntries: PathEntry[];

  /** Total number of environment variables on the system */
  totalVarCount: number;
}
