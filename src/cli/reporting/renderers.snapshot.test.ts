/**
 * Renderer Snapshot Tests
 *
 * Locks in the exact serialised output of JsonRenderer and MarkdownRenderer
 * so that any accidental formatting regression — changed headings, reordered
 * fields, extra whitespace, broken table columns — is immediately visible
 * as a diff in the Vitest snapshot output.
 *
 * These tests complement renderers.test.ts (which validates structure/shape).
 * When you intentionally change renderer output, update the snapshots with:
 *
 *   npx vitest --run --reporter=verbose -u src/cli/reporting/renderers.snapshot.test.ts
 *
 * Snapshot files are stored in __snapshots__/ alongside this file.
 *
 * ADR: suggestion #19 — snapshot tests for CLI output.
 */

import { describe, it, expect } from 'vitest';
import { JsonRenderer } from './json-renderer.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import type { DiagnosticResult } from '../../core/types/diagnostic.js';
import type { DoctorResult } from '../../core/types/doctor-result.js';

// ── Fixtures ──────────────────────────────────────────────────────
//
// Timestamps are pinned to a fixed value so snapshots are deterministic.
// durationMs is also fixed for the same reason.

const FIXED_DATE = new Date('2026-07-13T12:00:00.000Z');

const diagResultPass: DiagnosticResult = {
  pluginName: 'node',
  displayName: 'Node.js',
  timestamp: FIXED_DATE,
  durationMs: 42,
  checks: [
    {
      name: 'node-version',
      label: 'Node.js Version',
      status: 'pass',
      message: 'Node.js v22.0.0 is installed. (LTS)',
      detail: 'Node.js v22 is a Long Term Support release. LTS versions receive security updates for 30 months.',
    },
    {
      name: 'npm-version',
      label: 'npm Version',
      status: 'pass',
      message: 'npm 10.0.0 is installed.',
    },
    {
      name: 'node-path',
      label: 'Node.js PATH',
      status: 'pass',
      message: 'Node.js is on the PATH at /usr/local/bin/node.',
      detail: 'The node binary is accessible from the system PATH.',
    },
  ],
  overallStatus: 'pass',
};

const diagResultMixed: DiagnosticResult = {
  pluginName: 'node',
  displayName: 'Node.js',
  timestamp: FIXED_DATE,
  durationMs: 55,
  checks: [
    {
      name: 'node-version',
      label: 'Node.js Version',
      status: 'pass',
      message: 'Node.js v22.0.0 is installed. (LTS)',
      detail: 'Node.js v22 is LTS.',
    },
    {
      name: 'npm-version',
      label: 'npm Version',
      status: 'warn',
      message: 'npm 9.0.0 may be outdated.',
      detail: 'npm 9 is behind the current stable release.',
      suggestion: 'Run npm install -g npm to upgrade.',
    },
    {
      name: 'node-path',
      label: 'Node.js PATH',
      status: 'fail',
      message: 'Node.js not found on PATH.',
      detail: 'The node binary could not be resolved.',
      suggestion: 'Add the Node.js bin directory to your PATH.',
    },
  ],
  overallStatus: 'fail',
};

const diagResultWithDependsOn: DiagnosticResult = {
  pluginName: 'redis',
  displayName: 'Redis',
  timestamp: FIXED_DATE,
  durationMs: 30,
  checks: [
    {
      name: 'redis-installation',
      label: 'Redis Installation',
      status: 'fail',
      message: 'Redis is not installed or not found on the system PATH.',
      suggestion: 'Install Redis from https://redis.io/download',
    },
    {
      name: 'redis-port',
      label: 'Redis Port (6379)',
      status: 'skip',
      message: 'Skipped — depends on "redis-installation" which did not pass.',
      dependsOn: ['redis-installation'],
    },
    {
      name: 'redis-ping',
      label: 'Redis Connectivity',
      status: 'skip',
      message: 'Skipped — depends on "redis-installation" which did not pass.',
      dependsOn: ['redis-installation', 'redis-port'],
    },
  ],
  overallStatus: 'fail',
};

const doctorResult: DoctorResult = {
  diagnostics: [diagResultMixed],
  tools: [
    {
      name: 'Git',
      command: 'git',
      version: '2.43.0',
      path: '/usr/bin/git',
      installed: true,
      category: 'version-control',
    },
    {
      name: 'Docker',
      command: 'docker',
      version: undefined,
      path: undefined,
      installed: false,
      category: 'container',
    },
  ],
  health: {
    percentage: 33,
    status: 'unhealthy',
    totalChecks: 3,
    passedChecks: 1,
    warningChecks: 1,
    failedChecks: 1,
  },
  timestamp: FIXED_DATE,
  durationMs: 120,
};

const doctorResultHealthy: DoctorResult = {
  diagnostics: [diagResultPass],
  tools: [
    {
      name: 'Git',
      command: 'git',
      version: '2.43.0',
      path: '/usr/bin/git',
      installed: true,
      category: 'version-control',
    },
  ],
  health: {
    percentage: 100,
    status: 'healthy',
    totalChecks: 3,
    passedChecks: 3,
    warningChecks: 0,
    failedChecks: 0,
  },
  timestamp: FIXED_DATE,
  durationMs: 80,
};

// ── JSON Renderer Snapshots ───────────────────────────────────────

describe('JsonRenderer snapshots', () => {
  const renderer = new JsonRenderer();

  it('renderDiagnostic — all passing', () => {
    expect(renderer.renderDiagnostic(diagResultPass)).toMatchSnapshot();
  });

  it('renderDiagnostic — mixed pass/warn/fail', () => {
    expect(renderer.renderDiagnostic(diagResultMixed)).toMatchSnapshot();
  });

  it('renderDiagnostic — with dependsOn skipped checks', () => {
    expect(renderer.renderDiagnostic(diagResultWithDependsOn)).toMatchSnapshot();
  });

  it('renderDoctor — unhealthy with issues', () => {
    expect(renderer.renderDoctor(doctorResult)).toMatchSnapshot();
  });

  it('renderDoctor — fully healthy', () => {
    expect(renderer.renderDoctor(doctorResultHealthy)).toMatchSnapshot();
  });
});

// ── Markdown Renderer Snapshots ───────────────────────────────────

describe('MarkdownRenderer snapshots', () => {
  const renderer = new MarkdownRenderer();

  it('renderDiagnostic — all passing', () => {
    expect(renderer.renderDiagnostic(diagResultPass)).toMatchSnapshot();
  });

  it('renderDiagnostic — mixed pass/warn/fail', () => {
    expect(renderer.renderDiagnostic(diagResultMixed)).toMatchSnapshot();
  });

  it('renderDiagnostic — with dependsOn skipped checks', () => {
    expect(renderer.renderDiagnostic(diagResultWithDependsOn)).toMatchSnapshot();
  });

  it('renderDoctor — unhealthy with issues', () => {
    expect(renderer.renderDoctor(doctorResult)).toMatchSnapshot();
  });

  it('renderDoctor — fully healthy (no issues section)', () => {
    expect(renderer.renderDoctor(doctorResultHealthy)).toMatchSnapshot();
  });
});
