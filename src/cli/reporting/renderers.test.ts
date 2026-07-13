/**
 * Renderer Tests
 *
 * Verifies that JsonRenderer and MarkdownRenderer produce
 * well-formed output from fixture data.
 */

import { describe, it, expect } from 'vitest';
import { JsonRenderer } from './json-renderer.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { DoctorResult } from '../../core/types/doctor-result.js';

// ── Fixtures ──────────────────────────────────────────────────────

const diagResult: DiagnosticResult = {
  pluginName: 'node',
  displayName: 'Node.js',
  timestamp: new Date('2026-07-13T12:00:00Z'),
  durationMs: 42,
  checks: [
    {
      name: 'node-version',
      label: 'Node.js Version',
      status: 'pass',
      message: 'v22.0.0 detected.',
      detail: 'Node.js v22 is LTS.',
    },
    {
      name: 'npm-version',
      label: 'npm Version',
      status: 'warn',
      message: 'npm 9.0.0 may be outdated.',
      suggestion: 'Run npm install -g npm to upgrade.',
    },
    {
      name: 'node-path',
      label: 'Node.js PATH',
      status: 'fail',
      message: 'Node.js not on PATH.',
      suggestion: 'Add Node.js to your PATH.',
    },
  ],
  overallStatus: 'fail',
};

const doctorResult: DoctorResult = {
  diagnostics: [diagResult],
  tools: [
    { name: 'Git', command: 'git', version: '2.43.0', path: '/usr/bin/git', installed: true, category: 'version-control' },
    { name: 'Docker', command: 'docker', version: undefined, path: undefined, installed: false, category: 'container' },
  ],
  health: {
    percentage: 33,
    status: 'unhealthy',
    totalChecks: 3,
    passedChecks: 1,
    warningChecks: 1,
    failedChecks: 1,
  },
  timestamp: new Date('2026-07-13T12:00:00Z'),
  durationMs: 120,
};

// ── JSON Renderer ─────────────────────────────────────────────────

describe('JsonRenderer', () => {
  const renderer = new JsonRenderer();

  it('renderDiagnostic produces valid JSON', () => {
    const output = renderer.renderDiagnostic(diagResult);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('renderDiagnostic includes all checks', () => {
    const parsed = JSON.parse(renderer.renderDiagnostic(diagResult));
    expect(parsed.checks).toHaveLength(3);
    expect(parsed.pluginName).toBe('node');
    expect(parsed.overallStatus).toBe('fail');
  });

  it('renderDoctor produces valid JSON', () => {
    const output = renderer.renderDoctor(doctorResult);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('renderDoctor includes health score', () => {
    const parsed = JSON.parse(renderer.renderDoctor(doctorResult));
    expect(parsed.health.percentage).toBe(33);
    expect(parsed.health.status).toBe('unhealthy');
  });

  it('renderDoctor includes tools', () => {
    const parsed = JSON.parse(renderer.renderDoctor(doctorResult));
    expect(parsed.tools).toHaveLength(2);
  });
});

// ── Markdown Renderer ─────────────────────────────────────────────

describe('MarkdownRenderer', () => {
  const renderer = new MarkdownRenderer();

  it('renderDiagnostic starts with an h1 heading', () => {
    const output = renderer.renderDiagnostic(diagResult);
    expect(output).toMatch(/^# Node\.js Diagnostics/);
  });

  it('renderDiagnostic contains a summary table', () => {
    const output = renderer.renderDiagnostic(diagResult);
    expect(output).toContain('| Overall |');
    expect(output).toContain('| Checks |');
  });

  it('renderDiagnostic includes issues section for non-passing checks', () => {
    const output = renderer.renderDiagnostic(diagResult);
    expect(output).toContain('## Issues & Recommendations');
    expect(output).toContain('npm Version');
    expect(output).toContain('Node.js PATH');
  });

  it('renderDiagnostic includes suggestions', () => {
    const output = renderer.renderDiagnostic(diagResult);
    expect(output).toContain('Run npm install -g npm to upgrade.');
  });

  it('renderDoctor starts with the health report heading', () => {
    const output = renderer.renderDoctor(doctorResult);
    expect(output).toMatch(/^# Dev Doctor — Health Report/);
  });

  it('renderDoctor includes health score section', () => {
    const output = renderer.renderDoctor(doctorResult);
    expect(output).toContain('## Health Score');
    expect(output).toContain('33%');
    expect(output).toContain('Unhealthy');
  });

  it('renderDoctor includes development tools table', () => {
    const output = renderer.renderDoctor(doctorResult);
    expect(output).toContain('## Development Tools');
    expect(output).toContain('Git');
    expect(output).toContain('Docker');
  });

  it('renderDoctor marks missing tools as not found', () => {
    const output = renderer.renderDoctor(doctorResult);
    expect(output).toContain('⏭️ Not found');
  });
});
