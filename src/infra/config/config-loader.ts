/**
 * Config Loader
 *
 * Reads, validates, and merges the two config file levels:
 *
 *   1. User-level:    ~/.devdoctor/config.json   (lowest priority)
 *   2. Project-level: <cwd>/devdoctor.json        (highest priority)
 *
 * Merging strategy: project fields override user fields.
 * The `plugins` map is merged key-by-key, not replaced wholesale.
 *
 * What this teaches:
 * - Two-tier config resolution (user defaults vs project specifics)
 * - Runtime type validation without a schema library
 * - Graceful degradation — invalid or missing files don't crash the app
 *
 * Architecture note:
 * Lives in the Infrastructure layer. It reads from the filesystem (OS concern)
 * and returns a typed Core type (ResolvedConfig). The Composition Root is the
 * only caller — it loads config once and passes it down.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  DevDoctorConfig,
  ResolvedConfig,
  ReportFormat,
  PluginConfig,
} from '../../core/types/config.js';
import { CONFIG_DEFAULTS } from '../../core/types/config.js';

// ── File locations ────────────────────────────────────────────────

const PROJECT_CONFIG_FILENAME = 'devdoctor.json';
const USER_CONFIG_DIR = path.join(os.homedir(), '.devdoctor');
const USER_CONFIG_PATH = path.join(USER_CONFIG_DIR, 'config.json');

// ── Runtime type validation ───────────────────────────────────────

const VALID_FORMATS = new Set<string>(['terminal', 'json', 'markdown']);

/**
 * Validate that an unknown value conforms to DevDoctorConfig.
 * Returns a clean, safe partial config — any invalid fields are dropped
 * rather than throwing, so a config with one bad field doesn't break everything.
 */
function parseConfig(raw: unknown, source: string): DevDoctorConfig {
  if (typeof raw !== 'object' || raw === null) {
    console.warn(`[devdoctor] Config at ${source} is not a JSON object — skipping.`);
    return {};
  }

  const obj = raw as Record<string, unknown>;
  const result: DevDoctorConfig = {};

  // defaultFormat
  if (obj.defaultFormat !== undefined) {
    if (typeof obj.defaultFormat === 'string' && VALID_FORMATS.has(obj.defaultFormat)) {
      result.defaultFormat = obj.defaultFormat as ReportFormat;
    } else {
      console.warn(
        `[devdoctor] Invalid defaultFormat "${obj.defaultFormat}" in ${source}. ` +
          `Valid values: ${[...VALID_FORMATS].join(', ')}. Using default.`,
      );
    }
  }

  // reportOutputDir
  if (obj.reportOutputDir !== undefined) {
    if (typeof obj.reportOutputDir === 'string' && obj.reportOutputDir.trim().length > 0) {
      result.reportOutputDir = obj.reportOutputDir.trim();
    } else {
      console.warn(
        `[devdoctor] Invalid reportOutputDir in ${source} — must be a non-empty string.`,
      );
    }
  }

  // plugins
  if (obj.plugins !== undefined) {
    if (typeof obj.plugins === 'object' && obj.plugins !== null && !Array.isArray(obj.plugins)) {
      const plugins: Record<string, PluginConfig> = {};
      for (const [name, val] of Object.entries(obj.plugins as Record<string, unknown>)) {
        if (typeof val === 'object' && val !== null) {
          const pluginObj = val as Record<string, unknown>;
          plugins[name] = {
            disabled: typeof pluginObj.disabled === 'boolean' ? pluginObj.disabled : undefined,
          };
        }
      }
      result.plugins = plugins;
    } else {
      console.warn(`[devdoctor] Invalid plugins field in ${source} — must be an object.`);
    }
  }

  return result;
}

/**
 * Attempt to read and parse a JSON config file.
 * Returns an empty object if the file doesn't exist or can't be parsed.
 */
function readConfigFile(filePath: string): DevDoctorConfig {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const raw: unknown = JSON.parse(content);
    return parseConfig(raw, filePath);
  } catch (err) {
    console.warn(
      `[devdoctor] Failed to read config file at ${filePath}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    return {};
  }
}

// ── Merge logic ───────────────────────────────────────────────────

/**
 * Deep-merge two partial configs. Project config takes precedence.
 * The plugins map is merged key-by-key so disabling one plugin in the user
 * config doesn't wipe out project-level plugin settings.
 */
function mergeConfigs(user: DevDoctorConfig, project: DevDoctorConfig): DevDoctorConfig {
  return {
    defaultFormat: project.defaultFormat ?? user.defaultFormat,
    reportOutputDir: project.reportOutputDir ?? user.reportOutputDir,
    plugins: {
      ...user.plugins,
      ...project.plugins,
    },
  };
}

/**
 * Apply defaults to a partial config, producing a fully resolved config.
 */
function applyDefaults(partial: DevDoctorConfig): ResolvedConfig {
  return {
    defaultFormat: partial.defaultFormat ?? CONFIG_DEFAULTS.defaultFormat,
    reportOutputDir: partial.reportOutputDir ?? CONFIG_DEFAULTS.reportOutputDir,
    plugins: partial.plugins ?? CONFIG_DEFAULTS.plugins,
  };
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Load and resolve the DevDoctor configuration.
 *
 * Resolution order (highest priority last):
 *   ~/.devdoctor/config.json  →  <cwd>/devdoctor.json
 *
 * Returns a fully resolved config with all fields populated.
 * This function never throws — bad config files produce warnings and fall back to defaults.
 */
export function loadConfig(): ResolvedConfig {
  const userConfig = readConfigFile(USER_CONFIG_PATH);
  const projectConfigPath = path.join(process.cwd(), PROJECT_CONFIG_FILENAME);
  const projectConfig = readConfigFile(projectConfigPath);

  const merged = mergeConfigs(userConfig, projectConfig);
  return applyDefaults(merged);
}

/**
 * Get the path where a project config file would be created.
 * Useful for the `devdoctor config init` command (future).
 */
export function getProjectConfigPath(): string {
  return path.join(process.cwd(), PROJECT_CONFIG_FILENAME);
}

/**
 * Get the path to the user-level config file.
 */
export function getUserConfigPath(): string {
  return USER_CONFIG_PATH;
}

/**
 * Write a config object to the project config file.
 * Creates the file if it doesn't exist. Merges with existing content.
 *
 * Fix #6: validates that the resolved config path stays within process.cwd()
 * to match the containment check already applied in writeReport() (ADR-0009).
 *
 * @param config - The config to write (partial — only specified fields are written)
 */
export function writeProjectConfig(config: DevDoctorConfig): void {
  const configPath = getProjectConfigPath();

  // Path containment check — consistent with renderer-factory.ts writeReport()
  const safeRoot = path.resolve(process.cwd());
  const resolved = path.resolve(configPath);
  if (!resolved.startsWith(safeRoot + path.sep) && resolved !== safeRoot) {
    throw new Error(`Config path "${resolved}" escapes the project directory "${safeRoot}".`);
  }

  const existing = readConfigFile(configPath);
  const merged = mergeConfigs(existing, config);

  // Remove undefined values before serialising
  const clean = JSON.parse(JSON.stringify(merged)) as DevDoctorConfig;
  fs.writeFileSync(configPath, JSON.stringify(clean, null, 2) + '\n', 'utf-8');
}
