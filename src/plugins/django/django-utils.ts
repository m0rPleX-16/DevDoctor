import fs from 'node:fs';
import path from 'node:path';

/**
 * Recursively find settings.py files in the directory up to a certain depth.
 */
export function findSettingsFiles(dir: string, maxDepth = 3, currentDepth = 0): string[] {
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return [];

  const results: string[] = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip common large/irrelevant directories
        if (
          ['node_modules', '.venv', 'venv', '.git', 'build', 'dist', '__pycache__'].includes(
            entry.name,
          )
        ) {
          continue;
        }
        results.push(...findSettingsFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && entry.name === 'settings.py') {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }
  return results;
}

/**
 * Parse a Python assignment for a setting in a settings.py file.
 * Returns the raw string value (excluding quotes) or boolean/list string representation.
 */
export function parseDjangoSetting(filePath: string, settingName: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Regex matches e.g. SECRET_KEY = '...' or SECRET_KEY = "..." or DEBUG = True or ALLOWED_HOSTS = [...]
    // Also handles multiline or trailing comments
    const regex = new RegExp(`^\\s*${settingName}\\s*=\\s*(['"])(.*?)\\1`, 'm');
    const match = content.match(regex);
    if (match) {
      return match[2];
    }

    // Fallback for non-string assignments like booleans (True/False) or lists
    const fallbackRegex = new RegExp(`^\\s*${settingName}\\s*=\\s*([^#\\n]+)`, 'm');
    const fallbackMatch = content.match(fallbackRegex);
    if (fallbackMatch) {
      return fallbackMatch[1].trim();
    }
  } catch {
    // Ignore errors
  }
  return null;
}
