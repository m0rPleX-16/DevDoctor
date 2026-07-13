/**
 * Audit Logger
 *
 * Appends an immutable record of every repair action to
 * ~/.devdoctor/history.json (NDJSON format — one JSON object per line).
 *
 * What this teaches:
 * - Why audit trails matter for operational tooling
 * - NDJSON: a simple, grep-friendly format for append-only logs
 * - The difference between a persistent log and an in-memory log
 * - Why audit writes must never block or fail a primary operation
 *
 * ADR-0011: Repair Audit Log
 *
 * Architecture note:
 * Lives in the Infrastructure layer — it writes to the filesystem (OS concern).
 * The RepairEngine (Core layer) calls this via the IAuditLogger interface,
 * keeping the Core layer free of filesystem dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ── Types ─────────────────────────────────────────────────────────

export type AuditAction = 'repair' | 'verify' | 'rollback';

export interface AuditEntry {
  /** ISO 8601 UTC timestamp */
  timestamp: string;
  /** Plugin name (e.g. "mysql") */
  plugin: string;
  /** Check name within the plugin (e.g. "mysql-service") */
  checkName: string;
  /** The action that was performed */
  action: AuditAction;
  /** Whether the action succeeded */
  success: boolean;
  /** Human-readable result message */
  message: string;
  /** Whether this was a dry run (no actual changes were made) */
  dryRun: boolean;
}

// ── Interface ─────────────────────────────────────────────────────

/**
 * The interface the Core layer depends on (via dependency injection).
 * The Core layer never imports from the Infrastructure layer directly.
 */
export interface IAuditLogger {
  log(entry: AuditEntry): void;
}

// ── Null logger (for tests / dry-run) ────────────────────────────

/** A no-op logger used in tests or when audit logging is disabled. */
export const nullAuditLogger: IAuditLogger = {
  log: () => { /* intentionally empty */ },
};

// ── File-backed logger ────────────────────────────────────────────

const AUDIT_DIR = path.join(os.homedir(), '.devdoctor');
const AUDIT_FILE = path.join(AUDIT_DIR, 'history.json');

/**
 * An audit logger that appends entries to ~/.devdoctor/history.json.
 *
 * Each entry is a single JSON object on its own line (NDJSON).
 * Writes are synchronous and use O_APPEND to avoid races with concurrent
 * Dev Doctor processes. Errors are swallowed — audit failures must never
 * interrupt a repair operation.
 */
export class FileAuditLogger implements IAuditLogger {
  /**
   * Append one audit entry. Never throws.
   */
  log(entry: AuditEntry): void {
    try {
      this.ensureDir();
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(AUDIT_FILE, line, { encoding: 'utf-8', flag: 'a' });
    } catch (err) {
      // Audit logging must never fail a repair — log to stderr and continue.
      process.stderr.write(
        `[devdoctor] Warning: Could not write audit log: ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      );
    }
  }

  /** Ensure the ~/.devdoctor directory exists. */
  private ensureDir(): void {
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }
  }

  /** Return the resolved path to the audit file (useful for display). */
  static get filePath(): string {
    return AUDIT_FILE;
  }
}
