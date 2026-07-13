/**
 * JSON Renderer
 *
 * Serialises diagnostic and doctor results to indented JSON.
 *
 * What this teaches:
 * - Why machine-readable output matters (CI pipelines, tooling integrations)
 * - How JSON.stringify handles Date objects (they become ISO strings)
 * - The Strategy Pattern — swapping a renderer changes the entire output
 *   format without touching the command logic
 *
 * Architecture note:
 * Lives in the CLI layer. Has no external dependencies — plain JSON
 * serialisation requires nothing beyond the standard library.
 */

import type { ReportRenderer } from '../../core/reporting/report-renderer.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { DoctorResult } from '../../core/types/doctor-result.js';

export class JsonRenderer implements ReportRenderer {
  renderDiagnostic(result: DiagnosticResult): string {
    return JSON.stringify(result, null, 2);
  }

  renderDoctor(result: DoctorResult): string {
    return JSON.stringify(result, null, 2);
  }
}
