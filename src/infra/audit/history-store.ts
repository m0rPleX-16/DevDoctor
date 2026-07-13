/**
 * History Store
 *
 * Reads and writes diagnostic run history to ~/.devdoctor/runs.json (NDJSON).
 *
 * Each line is a HistoryEntry JSON object written after every `devdoctor doctor`
 * run. The store is append-only — entries are never modified or deleted.
 *
 * Architecture note:
 * Lives in the Infrastructure layer. The CLI layer calls this directly via
 * the IHistoryStore interface, keeping the core free of filesystem concerns.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { HistoryEntry } from '../../core/types/history.js';

const HISTORY_DIR = path.join(os.homedir(), '.devdoctor');
const HISTORY_FILE = path.join(HISTORY_DIR, 'runs.json');

/** Maximum number of entries retained in the history file on reads. */
const MAX_HISTORY_ENTRIES = 100;

export interface IHistoryStore {
  append(entry: HistoryEntry): void;
  read(): HistoryEntry[];
}

/**
 * File-backed history store.
 * Appends one NDJSON line per doctor run. Reads all stored entries.
 * Write errors are swallowed — history failures must never interrupt diagnostics.
 */
export class FileHistoryStore implements IHistoryStore {
  static get filePath(): string {
    return HISTORY_FILE;
  }

  append(entry: HistoryEntry): void {
    try {
      this.ensureDir();
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(HISTORY_FILE, line, { encoding: 'utf-8', flag: 'a' });
    } catch (err) {
      process.stderr.write(
        `[devdoctor] Warning: Could not write history: ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      );
    }
  }

  read(): HistoryEntry[] {
    if (!fs.existsSync(HISTORY_FILE)) return [];

    try {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const entries = raw
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          try {
            return JSON.parse(line) as HistoryEntry;
          } catch {
            return null;
          }
        })
        .filter((e): e is HistoryEntry => e !== null);

      // Return the most recent MAX_HISTORY_ENTRIES entries
      return entries.slice(-MAX_HISTORY_ENTRIES);
    } catch {
      return [];
    }
  }

  private ensureDir(): void {
    if (!fs.existsSync(HISTORY_DIR)) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
  }
}

/** No-op store for tests. */
export const nullHistoryStore: IHistoryStore = {
  append: () => {},
  read: () => [],
};
