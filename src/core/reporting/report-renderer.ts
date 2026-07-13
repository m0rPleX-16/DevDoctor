/**
 * Report Renderer Interface
 *
 * The abstraction that decouples "what data to display" from
 * "how to display it". Every output format implements this interface.
 *
 * Architecture note:
 * Lives in the Core layer — it only depends on Core domain types.
 * Concrete renderers live in the CLI layer (they may depend on chalk,
 * file system, etc.) and are selected in the Composition Root.
 *
 * Design Pattern: Strategy Pattern
 * The format flag (--format terminal|json|markdown) selects the renderer
 * strategy at runtime. The command handlers don't know which renderer
 * they're using — they just call render() and handle the string result.
 */

import type { DiagnosticResult } from '../types/diagnostic.js';
import type { DoctorResult } from '../types/doctor-result.js';

/**
 * A renderer produces a formatted string representation of a result.
 * The caller decides whether to print it to stdout or write it to a file.
 */
export interface DiagnosticRenderer {
  /** Render a single-plugin diagnostic result */
  renderDiagnostic(result: DiagnosticResult): string;
}

export interface DoctorRenderer {
  /** Render the full doctor health dashboard */
  renderDoctor(result: DoctorResult): string;
}

/**
 * A full renderer implements both interfaces.
 */
export interface ReportRenderer extends DiagnosticRenderer, DoctorRenderer {}
