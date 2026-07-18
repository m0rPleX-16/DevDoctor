import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

function getFolderSize(
  dirPath: string,
  state = { totalSize: 0, fileCount: 0 },
  maxFiles = 1000,
): number {
  if (!fs.existsSync(dirPath)) return 0;

  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return stats.size;
    }

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (state.fileCount >= maxFiles) break;
      const fullPath = path.join(dirPath, file);
      try {
        const fileStats = fs.statSync(fullPath);
        if (fileStats.isDirectory()) {
          getFolderSize(fullPath, state, maxFiles);
        } else {
          state.totalSize += fileStats.size;
          state.fileCount++;
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return state.totalSize;
}

export async function checkNextjsCacheStaleness(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const nextCachePath = path.join(cwd, '.next', 'cache');
  const nodeModulesCachePath = path.join(cwd, 'node_modules', '.cache');

  let nextCacheSize = 0;
  let nodeModulesCacheSize = 0;

  if (fs.existsSync(nextCachePath)) {
    nextCacheSize = getFolderSize(nextCachePath);
  }

  if (fs.existsSync(nodeModulesCachePath)) {
    nodeModulesCacheSize = getFolderSize(nodeModulesCachePath);
  }

  const totalCacheSizeMb = Math.round((nextCacheSize + nodeModulesCacheSize) / (1024 * 1024));
  const limitMb = 500;

  if (totalCacheSizeMb > limitMb) {
    return {
      name: 'nextjs-cache-staleness',
      label: 'Next.js Cache Staleness',
      status: 'warn',
      message: `Next.js cache size is large: ${totalCacheSizeMb}MB (exceeds ${limitMb}MB).`,
      detail:
        'Next.js caches build assets, images, and pages in .next/cache to speed up subsequent builds. Over time, this cache can grow excessively large or contain stale data, occasionally leading to memory leaks or weird build behaviors.',
      suggestion:
        'Clear the cache by running: rm -rf .next or npm run build after clearing the cache. This will force Next.js to rebuild all pages and assets from scratch.',
    };
  }

  return {
    name: 'nextjs-cache-staleness',
    label: 'Next.js Cache Staleness',
    status: 'pass',
    message: `Next.js cache size is healthy (${totalCacheSizeMb}MB).`,
    detail: 'Build and asset cache sizes are within recommended limits.',
  };
}
