/**
 * Configuration Parser
 *
 * Safely parses common configuration file formats (.ini / .cnf / .json).
 */

import fs from 'node:fs';

/**
 * Parses INI/CNF style configurations into a nested key-value record.
 * Handles:
 * - Comments starting with # or ;
 * - Sections defined by [section]
 * - Group properties under sections
 */
export function parseIni(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentSection = 'default';

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines or comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    // Check for section
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).trim();
      continue;
    }

    // Key-value pair split by first '='
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const rawValue = trimmed.slice(eqIndex + 1).trim();

      // Clean value (strip inline comments and quotes)
      let value = rawValue;
      const commentIndex = value.match(/\s*[#;]/);
      if (commentIndex && commentIndex.index !== undefined) {
        value = value.slice(0, commentIndex.index).trim();
      }

      // Remove surrounding quotes if matching
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      result[currentSection][key] = value;
    }
  }

  return result;
}

/**
 * Safely read and parse a JSON or INI config file from disk.
 * Returns parsed object, or empty record if error or missing.
 */
export async function parseConfigFile(filePath: string): Promise<Record<string, any>> {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    }

    // Default to INI parsing for .ini / .cnf / etc.
    return parseIni(content);
  } catch {
    return {};
  }
}
