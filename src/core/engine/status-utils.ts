/**
 * Status Utilities
 *
 * Shared helpers for deriving aggregate check statuses and resolving
 * dependency-aware check ordering.
 * Extracted here so every plugin uses identical precedence logic
 * rather than duplicating the same function.
 */

import type { CheckStatus, DiagnosticCheck } from '../types/diagnostic.js';

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

/**
 * Resolve dependency-aware check ordering (suggestion #7).
 *
 * Given an ordered list of already-run checks, for each check that declares
 * `dependsOn`, verify every named dependency passed. If any dependency did
 * not pass, replace the check with a skip result rather than running it.
 *
 * Use this when a plugin runs checks sequentially and some checks are only
 * meaningful if prior checks succeeded — e.g. a port check that depends on
 * the service being installed.
 *
 * @param checks  - Array of DiagnosticCheck results in execution order
 * @returns       - The same array with dependency-skipped checks substituted
 */
export function applyDependencySkips(checks: DiagnosticCheck[]): DiagnosticCheck[] {
  // Build a quick lookup of name → status for already-resolved checks
  const resolved = new Map<string, CheckStatus>();

  return checks.map((check) => {
    // Record this check's status after we decide it
    const resolve = (c: DiagnosticCheck): DiagnosticCheck => {
      resolved.set(c.name, c.status);
      return c;
    };

    if (!check.dependsOn || check.dependsOn.length === 0) {
      return resolve(check);
    }

    // Find the first dependency that did not pass
    const blockedBy = check.dependsOn.find((dep) => {
      const depStatus = resolved.get(dep);
      return depStatus === undefined || depStatus !== 'pass';
    });

    if (blockedBy) {
      return resolve({
        ...check,
        status: 'skip',
        message: `Skipped — depends on "${blockedBy}" which did not pass.`,
        detail: check.detail,
        suggestion: check.suggestion,
      });
    }

    return resolve(check);
  });
}
