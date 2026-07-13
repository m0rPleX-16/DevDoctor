/**
 * Status Utilities
 *
 * Shared helpers for deriving aggregate check statuses.
 * Extracted here so every plugin uses identical precedence logic
 * rather than duplicating the same function.
 */

import type { CheckStatus } from '../types/diagnostic.js';

/**
 * Derive the overall status from a list of individual check statuses.
 * Returns the "worst" status found.
 *
 * Priority: fail > warn > skip > pass
 */
export function deriveOverallStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.includes('skip')) return 'skip';
  return 'pass';
}
