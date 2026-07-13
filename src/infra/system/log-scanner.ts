/**
 * Log Scanner
 *
 * Scans log files for warning and failure logs.
 */

import fs from 'node:fs';

export interface LogScanResult {
  filePath: string;
  exists: boolean;
  totalLines: number;
  recentLines: string[];
  matchedErrors: string[];
}

/**
 * Safe utility to scan log files. Reads the last N lines, verifies file sizes,
 * and extracts lines matching a set of error keywords.
 */
export async function scanLogFile(
  filePath: string,
  options: { maxLines?: number; errorKeywords?: string[] } = {},
): Promise<LogScanResult> {
  const { maxLines = 50, errorKeywords = ['error', 'fatal', 'fail'] } = options;

  try {
    if (!fs.existsSync(filePath)) {
      return {
        filePath,
        exists: false,
        totalLines: 0,
        recentLines: [],
        matchedErrors: [],
      };
    }

    const stat = fs.statSync(filePath);
    // Ignore files larger than 50MB to prevent heap crashes
    if (stat.size > 50 * 1024 * 1024) {
      return {
        filePath,
        exists: true,
        totalLines: -1,
        recentLines: ['[Dev Doctor] Log file too large to parse (>50MB).'],
        matchedErrors: [],
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
    const totalLines = lines.length;

    // Get last N lines
    const recentLines = lines.slice(-maxLines);

    // Search errors in all lines
    const matchedErrors: string[] = [];
    const keywordRegexes = errorKeywords.map((kw) => new RegExp(`\\b${kw}\\b`, 'i'));

    for (const line of lines) {
      const match = keywordRegexes.some((regex) => regex.test(line));
      if (match) {
        matchedErrors.push(line);
      }
    }

    return {
      filePath,
      exists: true,
      totalLines,
      recentLines,
      matchedErrors: matchedErrors.slice(-10), // Return last 10 errors
    };
  } catch (error) {
    return {
      filePath,
      exists: true,
      totalLines: 0,
      recentLines: [`[Dev Doctor] Error reading file: ${error instanceof Error ? error.message : String(error)}`],
      matchedErrors: [],
    };
  }
}
