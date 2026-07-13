/**
 * Plugin Loader
 *
 * Dynamically discovers and loads plugins at startup by scanning the
 * plugins directory for subdirectories that export a Plugin-conforming class.
 *
 * What this teaches:
 * - Dynamic import() — loading modules at runtime rather than at compile time
 * - Runtime type validation — the TypeScript compiler can't check dynamic imports,
 *   so we must validate at runtime that the loaded module matches our interface
 * - The Open/Closed Principle in practice — new plugins require zero changes
 *   to the core application; just drop a new folder in src/plugins/
 *
 * Design Pattern: Registry + Factory
 * The loader acts as a Factory that discovers and instantiates plugins.
 * The PluginRegistry acts as the Repository that stores and looks them up.
 *
 * Architecture note:
 * Lives in the Infrastructure layer — it interacts with the filesystem
 * (reading directories) and the module system (dynamic import). It returns
 * Plugin instances (Core types) to the Composition Root (CLI layer).
 *
 * Packaging note (Phase 8):
 * When Dev Doctor is packaged as a standalone binary, dynamic filesystem
 * discovery won't work because there is no `plugins/` directory on disk.
 * In that scenario the loader falls back to the built-in plugin manifest
 * that is always available regardless of the execution environment.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Plugin } from '../../core/types/plugin.js';
import type { PluginRegistry } from '../../plugins/plugin-registry.js';
import type { ResolvedConfig } from '../../core/types/config.js';

// ── Built-in plugin manifest ──────────────────────────────────────
// These are always available; they're the compiled-in plugins.
// Dynamic discovery supplements this list; it never replaces it.

import { NodePlugin } from '../../plugins/node/index.js';
import { MysqlPlugin } from '../../plugins/mysql/index.js';
import { GitPlugin } from '../../plugins/git/index.js';
import { RedisPlugin } from '../../plugins/redis/index.js';
import { PythonPlugin } from '../../plugins/python/index.js';

const BUILTIN_PLUGINS: Plugin[] = [
  new NodePlugin(),
  new MysqlPlugin(),
  new GitPlugin(),
  new RedisPlugin(),
  new PythonPlugin(),
];

// ── Runtime type guard ────────────────────────────────────────────

/**
 * Validate at runtime that a value conforms to the Plugin interface.
 *
 * We can't use TypeScript's type system here because dynamic imports return
 * `unknown`. This guard checks the minimum required fields so we can register
 * the plugin safely and give a useful error if something is missing.
 */
function isPlugin(value: unknown): value is Plugin {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.name === 'string' &&
    obj.name.length > 0 &&
    typeof obj.displayName === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.diagnose === 'function' &&
    typeof obj.repair === 'function' &&
    typeof obj.verify === 'function'
  );
}

// ── Discovery logic ───────────────────────────────────────────────

/**
 * Attempt to load a plugin from a directory.
 *
 * Convention: each plugin directory must have an `index.js` (compiled) or
 * `index.ts` (development via tsx) that exports a default export or a named
 * export matching the plugin name (e.g., `NodePlugin`, `MysqlPlugin`).
 *
 * The loader tries:
 *   1. Default export
 *   2. Any named export that is a class with a zero-arg constructor
 *
 * @param pluginDir - Absolute path to the plugin directory
 * @returns A Plugin instance or null if loading failed
 */
async function loadPluginFromDir(pluginDir: string): Promise<Plugin | null> {
  // Try .js first (compiled output), then .ts (dev mode via tsx)
  const candidates = [
    path.join(pluginDir, 'index.js'),
    path.join(pluginDir, 'index.ts'),
  ];

  let modulePath: string | undefined;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      modulePath = candidate;
      break;
    }
  }

  if (!modulePath) return null;

  try {
    const moduleUrl = pathToFileURL(modulePath).href;
    const mod = await import(moduleUrl) as Record<string, unknown>;

    // Try each export in the module as a potential plugin constructor
    for (const [exportName, exported] of Object.entries(mod)) {
      // Try instantiating if it looks like a class
      if (typeof exported === 'function') {
        try {
          const instance = new (exported as new () => unknown)();
          if (isPlugin(instance)) {
            return instance;
          }
        } catch {
          // Not a no-arg constructor, skip
        }
      }
    }

    console.warn(`[devdoctor] Plugin at ${pluginDir} did not export a valid Plugin class.`);
    return null;
  } catch (err) {
    console.warn(
      `[devdoctor] Failed to load plugin from ${pluginDir}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Discover plugin directories by scanning the plugins root folder.
 * A valid plugin directory is a direct subdirectory that is not the
 * registry file itself (plugin-registry.ts is not a plugin).
 *
 * @param pluginsRoot - Absolute path to the plugins directory
 */
function discoverPluginDirs(pluginsRoot: string): string[] {
  if (!fs.existsSync(pluginsRoot)) return [];

  try {
    return fs
      .readdirSync(pluginsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(pluginsRoot, entry.name));
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────

export interface LoadResult {
  /** Number of plugins successfully loaded */
  loaded: number;
  /** Number of plugins skipped due to config or errors */
  skipped: number;
  /** Names of plugins that failed to load */
  errors: string[];
}

/**
 * Load all plugins into the registry.
 *
 * Strategy:
 * 1. Always register built-in plugins (compiled into the binary).
 * 2. Scan the plugins directory for additional/external plugins
 *    (only relevant in development; skipped in packaged binaries).
 * 3. Respect the `plugins.<name>.disabled` config flag.
 *
 * @param registry  - The PluginRegistry to register plugins into
 * @param config    - Resolved application config (for disabled flags)
 * @param pluginsRoot - Optional override for the plugins root directory
 */
export async function loadPlugins(
  registry: PluginRegistry,
  config: ResolvedConfig,
  pluginsRoot?: string,
): Promise<LoadResult> {
  const result: LoadResult = { loaded: 0, skipped: 0, errors: [] };

  // ── Step 1: Register built-in plugins ──
  for (const plugin of BUILTIN_PLUGINS) {
    const pluginConfig = config.plugins[plugin.name];
    if (pluginConfig?.disabled) {
      result.skipped++;
      continue;
    }

    if (registry.has(plugin.name)) {
      // Already registered (shouldn't happen in normal flow, but be safe)
      continue;
    }

    registry.register(plugin);
    result.loaded++;
  }

  // ── Step 2: Dynamic discovery (development / external plugins) ──
  // Derive the plugins root from this file's location if not provided.
  // In compiled output: dist/infra/plugins/plugin-loader.js → dist/plugins/
  if (!pluginsRoot) {
    const thisFile = fileURLToPath(import.meta.url);
    const distRoot = path.resolve(path.dirname(thisFile), '..', '..', '..'); // up to dist/ or src/
    pluginsRoot = path.join(distRoot, 'plugins');
  }

  const pluginDirs = discoverPluginDirs(pluginsRoot);

  for (const dir of pluginDirs) {
    const dirName = path.basename(dir);

    // Skip the built-in ones we already registered
    if (BUILTIN_PLUGINS.some((p) => p.name === dirName)) {
      continue;
    }

    // Respect disabled flag
    const pluginConfig = config.plugins[dirName];
    if (pluginConfig?.disabled) {
      result.skipped++;
      continue;
    }

    const plugin = await loadPluginFromDir(dir);
    if (!plugin) {
      result.errors.push(dirName);
      continue;
    }

    if (registry.has(plugin.name)) {
      // External plugin conflicts with a built-in name — skip it
      console.warn(
        `[devdoctor] External plugin "${plugin.name}" conflicts with a built-in plugin. Skipping.`,
      );
      result.skipped++;
      continue;
    }

    const pluginConfigByLoadedName = config.plugins[plugin.name];
    if (pluginConfigByLoadedName?.disabled) {
      result.skipped++;
      continue;
    }

    registry.register(plugin);
    result.loaded++;
  }

  return result;
}
