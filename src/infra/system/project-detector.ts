/**
 * Project Detector
 *
 * Scans the current working directory and parent directories for well-known
 * project marker files and directories, then maps them to the plugins that
 * are likely relevant.
 *
 * Visual technique:
 * Keeps disk access to O(1) per directory level by reading contents once
 * into a Set and performing fast in-memory checks.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Plugin } from '../../core/types/plugin.js';

export interface ProjectContext {
  /** Plugin names detected as relevant to the current directory */
  detectedPlugins: Set<string>;
  /** Marker files/dirs found, keyed by plugin name */
  matchedMarkers: Record<string, string[]>;
}

/**
 * Scan the current working directory and parent directories to determine
 * which plugins are relevant based on each plugin's declared `projectMarkers`.
 *
 * @param plugins  - The list of registered plugins to evaluate
 * @param cwd      - The directory to start scanning from (defaults to process.cwd())
 */
export function detectProjectContext(
  plugins: Plugin[],
  cwd: string = process.cwd(),
): ProjectContext {
  const detectedPlugins = new Set<string>();
  const matchedMarkers: Record<string, string[]> = {};

  // 1. Gather all directories to check (from cwd upwards, max 5 levels or home/root)
  const dirsToCheck: string[] = [];
  let currentDir = path.resolve(cwd);
  const homeDir = os.homedir();
  const maxLevels = 5;

  for (let i = 0; i < maxLevels; i++) {
    dirsToCheck.push(currentDir);

    const parentDir = path.dirname(currentDir);
    // Stop if we hit the file system root (parent is same as current)
    if (parentDir === currentDir) {
      break;
    }

    // Stop at the home directory to avoid scanning system-wide files
    if (currentDir === homeDir) {
      break;
    }

    currentDir = parentDir;
  }

  // 2. Cache directory contents to minimize disk hits
  const dirContentsCache = new Map<string, Set<string>>();
  const getDirContents = (dir: string): Set<string> => {
    if (dirContentsCache.has(dir)) {
      return dirContentsCache.get(dir)!;
    }
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const files = fs.readdirSync(dir);
        const fileSet = new Set(files);
        dirContentsCache.set(dir, fileSet);
        return fileSet;
      }
    } catch {
      // Ignore reading errors for restricted / locked folders
    }
    const empty = new Set<string>();
    dirContentsCache.set(dir, empty);
    return empty;
  };

  // 3. Check each plugin's markers against the collected directory contents
  for (const plugin of plugins) {
    if (!plugin.projectMarkers || plugin.projectMarkers.length === 0) continue;

    const found = new Set<string>();

    for (const dir of dirsToCheck) {
      const files = getDirContents(dir);

      for (const marker of plugin.projectMarkers) {
        if (marker.startsWith('*.')) {
          // Extension pattern check (e.g. "*.py")
          const extension = marker.slice(1);
          const hasMatch = Array.from(files).some((file) => file.endsWith(extension));
          if (hasMatch) {
            found.add(marker);
          }
        } else {
          // Exact filename/directory match
          if (files.has(marker)) {
            found.add(marker);
          }
        }
      }
    }

    if (found.size > 0) {
      detectedPlugins.add(plugin.name);
      matchedMarkers[plugin.name] = Array.from(found);
    }
  }

  return { detectedPlugins, matchedMarkers };
}
