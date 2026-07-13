/**
 * Renderer Factory
 *
 * Creates the appropriate ReportRenderer based on the requested format.
 * Also handles writing report output to a file when --output is specified.
 *
 * Architecture note:
 * Lives in the CLI layer. The Composition Root passes the resolved config
 * default format; individual commands can override via --format flag.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ReportRenderer } from '../../core/reporting/report-renderer.js';
import type { ReportFormat } from '../../core/types/config.js';
import { JsonRenderer } from './json-renderer.js';
import { MarkdownRenderer } from './markdown-renderer.js';

/**
 * Return the renderer for the given format.
 * Terminal rendering is handled inline by the existing command output logic —
 * this factory only covers the serialisable formats.
 */
export function createRenderer(format: ReportFormat): ReportRenderer | null {
  switch (format) {
    case 'json':
      return new JsonRenderer();
    case 'markdown':
      return new MarkdownRenderer();
    case 'terminal':
      return null; // Terminal output is handled by the existing chalk-based commands
  }
}

/**
 * Write report content to a file, creating directories as needed.
 *
 * @param content       - The rendered report string
 * @param outputPath    - Absolute or relative file path
 * @param outputDir     - Base directory (used when outputPath is just a filename)
 */
export function writeReport(
  content: string,
  outputPath: string,
  outputDir: string = process.cwd(),
): string {
  const resolved = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(outputDir, outputPath);

  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolved, content, 'utf-8');
  return resolved;
}

/**
 * Derive a default output filename from a plugin name and format.
 * e.g. "node", "json" → "devdoctor-node-2026-07-13.json"
 */
export function defaultOutputFilename(subject: string, format: ReportFormat): string {
  const date = new Date().toISOString().split('T')[0];
  const ext = format === 'markdown' ? 'md' : format;
  return `devdoctor-${subject}-${date}.${ext}`;
}
