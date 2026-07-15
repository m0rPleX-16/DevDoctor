/**
 * Audit Logger Types
 *
 * Domain representations of audit log entries, actions, and the logger interface.
 *
 * Architecture note:
 * Defined in Core/Domain layer. The actual file-backed logger is implemented
 * in the Infrastructure layer, keeping Core free of filesystem dependencies.
 */

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

/**
 * The interface the Core layer depends on (via dependency injection).
 */
export interface IAuditLogger {
  log(entry: AuditEntry): void;
}

/** A no-op logger used in tests or when audit logging is disabled. */
export const nullAuditLogger: IAuditLogger = {
  log: () => {
    /* intentionally empty */
  },
};
