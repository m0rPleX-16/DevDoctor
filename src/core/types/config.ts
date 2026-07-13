/**
 * Configuration Types
 *
 * The typed schema for devdoctor.json (project-level) and
 * ~/.devdoctor/config.json (user-level).
 *
 * Architecture note:
 * Lives in the Core layer — zero external dependencies.
 * The ConfigLoader (Infrastructure) populates this type;
 * the Composition Root (CLI) consumes it.
 */

/**
 * Output format for report commands.
 * - terminal  Plain colour-coded output (default)
 * - json      Machine-readable JSON to stdout or file
 * - markdown  GitHub-flavoured Markdown
 */
export type ReportFormat = 'terminal' | 'json' | 'markdown';

/**
 * Per-plugin overrides.
 */
export interface PluginConfig {
  /** Set to true to prevent this plugin from being loaded. */
  disabled?: boolean;
}

/**
 * The merged, validated configuration used at runtime.
 * All fields are optional — sensible defaults are applied by the loader.
 */
export interface DevDoctorConfig {
  /**
   * Default output format for diagnose / doctor commands.
   * Can be overridden per-invocation with --format.
   */
  defaultFormat?: ReportFormat;

  /**
   * Directory where report files are written when --output is used.
   * Defaults to the current working directory.
   */
  reportOutputDir?: string;

  /**
   * Per-plugin configuration, keyed by plugin name (e.g., "node", "mysql").
   */
  plugins?: Record<string, PluginConfig>;
}

/**
 * Resolved configuration — all optional fields replaced with their defaults.
 * This is what the rest of the application actually uses.
 */
export interface ResolvedConfig {
  defaultFormat: ReportFormat;
  reportOutputDir: string;
  plugins: Record<string, PluginConfig>;
}

/**
 * Default values applied when a field is absent from all config files.
 */
export const CONFIG_DEFAULTS: ResolvedConfig = {
  defaultFormat: 'terminal',
  reportOutputDir: process.cwd(),
  plugins: {},
};
