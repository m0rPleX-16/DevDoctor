/**
 * Project Detector
 *
 * Scans the current working directory for well-known project marker files
 * and directories, then maps them to the plugins that are likely relevant.
 *
 * This is intentionally lightweight — a simple `fs.existsSync` per marker
 * rather than deep directory traversal. The goal is to give the `doctor`
 * command enough context to visually group plugins by relevance, not to
 * perform full project analysis.
 *
 * What this teaches:
 * - How tools detect project type by looking for "marker" files
 * - Why package.json, pyproject.toml, .git etc. are meaningful signals
 * - How developer tools can adapt their output to context without config
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from '../../core/types/plugin.js';

export interface ProjectContext {
  /** Plugin names detected as relevant to the current directory */
  detectedPlugins: Set<string>;
  /** Marker files/dirs found in cwd, keyed by plugin name */
  matchedMarkers: Record<string, string[]>;
}

/**
 * Scan the current working directory and determine which plugins are
 * relevant based on each plugin's declared `projectMarkers`.
 *
 * @param plugins  - The list of registered plugins to evaluate
 * @param cwd      - The directory to scan (defaults to process.cwd())
 */
export function detectProjectContext(
  plugins: Plugin[],
  cwd: string = process.cwd(),
): ProjectContext {
  const detectedPlugins = new Set<string>();
  const matchedMarkers: Record<string, string[]> = {};

  for (const plugin of plugins) {
    if (!plugin.projectMarkers || plugin.projectMarkers.length === 0) continue;

    const found: string[] = [];
    for (const marker of plugin.projectMarkers) {
      if (fs.existsSync(path.join(cwd, marker))) {
        found.push(marker);
      }
    }

    if (found.length > 0) {
      detectedPlugins.add(plugin.name);
      matchedMarkers[plugin.name] = found;
    }
  }

  return { detectedPlugins, matchedMarkers };
}
