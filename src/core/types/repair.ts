/**
 * Repair and Verification Types
 *
 * Domain representations of repair actions and outcomes.
 */

export interface RepairResult {
  checkName: string;
  success: boolean;
  message: string;
  detail?: string;
  rollbackSupported: boolean;
}

export interface VerificationResult {
  checkName: string;
  success: boolean;
  message: string;
}
