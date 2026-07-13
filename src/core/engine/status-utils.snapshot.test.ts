/**
 * Status Utils Snapshot Tests
 *
 * Pins the exact output of applyDependencySkips() for a range of
 * dependency configurations. Because this utility transforms check
 * arrays in a way that's easy to accidentally break (wrong field copied,
 * wrong dep lookup, wrong status), snapshots catch regressions precisely.
 *
 * Update snapshots intentionally with:
 *   npx vitest --run -u src/core/engine/status-utils.snapshot.test.ts
 */

import { describe, it, expect } from 'vitest';
import { applyDependencySkips } from './status-utils.js';
import type { DiagnosticCheck } from '../types/diagnostic.js';

// ── Fixtures ──────────────────────────────────────────────────────

const pass = (name: string, deps?: string[]): DiagnosticCheck => ({
  name,
  label: `${name} label`,
  status: 'pass',
  message: `${name} passed`,
  detail: `detail for ${name}`,
  suggestion: undefined,
  dependsOn: deps,
});

const fail = (name: string, deps?: string[]): DiagnosticCheck => ({
  name,
  label: `${name} label`,
  status: 'fail',
  message: `${name} failed`,
  detail: `detail for ${name}`,
  suggestion: `fix ${name}`,
  dependsOn: deps,
});

const warn = (name: string, deps?: string[]): DiagnosticCheck => ({
  name,
  label: `${name} label`,
  status: 'warn',
  message: `${name} warned`,
  dependsOn: deps,
});

// ── Snapshot tests ────────────────────────────────────────────────

describe('applyDependencySkips snapshots', () => {
  it('no deps — returns checks unchanged', () => {
    const checks = [pass('a'), pass('b'), fail('c')];
    expect(applyDependencySkips(checks)).toMatchSnapshot();
  });

  it('all deps pass — no skips applied', () => {
    const checks = [
      pass('install'),
      pass('service', ['install']),
      pass('port', ['install']),
      pass('ping', ['install', 'port']),
    ];
    expect(applyDependencySkips(checks)).toMatchSnapshot();
  });

  it('root fails — all dependents become skip', () => {
    const checks = [
      fail('install'),
      warn('service', ['install']),
      pass('port', ['install']),
      pass('ping', ['install', 'port']),
      pass('memory', ['ping']),
    ];
    expect(applyDependencySkips(checks)).toMatchSnapshot();
  });

  it('middle dep fails — only downstream checks skip', () => {
    const checks = [
      pass('install'),
      fail('port', ['install']),
      pass('ping', ['install', 'port']),
      pass('memory', ['ping']),
    ];
    expect(applyDependencySkips(checks)).toMatchSnapshot();
  });

  it('warn dep — treated as not-pass, dependents skip', () => {
    const checks = [
      pass('install'),
      warn('service', ['install']),
      pass('port', ['service']),
    ];
    expect(applyDependencySkips(checks)).toMatchSnapshot();
  });

  it('unknown dep reference — check skips (dep not found = not pass)', () => {
    const checks = [
      pass('a'),
      pass('b', ['does-not-exist']),
    ];
    expect(applyDependencySkips(checks)).toMatchSnapshot();
  });

  it('preserves original fields on skipped checks (detail, suggestion retained)', () => {
    const checks = [
      fail('install'),
      {
        name: 'port',
        label: 'Port Check',
        status: 'pass' as const,
        message: 'port is free',
        detail: 'original detail',
        suggestion: 'original suggestion',
        dependsOn: ['install'],
      },
    ];
    const result = applyDependencySkips(checks);
    // Skipped check should retain detail and suggestion from the original
    expect(result[1].detail).toBe('original detail');
    expect(result[1].suggestion).toBe('original suggestion');
    expect(result[1].status).toBe('skip');
    expect(result).toMatchSnapshot();
  });

  it('empty array — returns empty array', () => {
    expect(applyDependencySkips([])).toMatchSnapshot();
  });

  it('single check no deps — returns as-is', () => {
    expect(applyDependencySkips([fail('only')])).toMatchSnapshot();
  });
});
