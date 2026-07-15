import { describe, it, expect, vi } from 'vitest';
import { runDiagnosticTasks } from './check-runner.js';
import type { DiagnosticTask } from '../types/diagnostic.js';

describe('check-runner', () => {
  it('runs all tasks if no dependencies are defined', async () => {
    const tasks: DiagnosticTask[] = [
      {
        name: 't1',
        label: 'T1',
        run: async () => ({ name: 't1', label: 'T1', status: 'pass', message: 'ok' }),
      },
      {
        name: 't2',
        label: 'T2',
        run: async () => ({ name: 't2', label: 'T2', status: 'pass', message: 'ok' }),
      },
    ];

    const results = await runDiagnosticTasks(tasks);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('t1');
    expect(results[1].name).toBe('t2');
  });

  it('skips dependent tasks if upstream dependency fails', async () => {
    const runSpy = vi
      .fn()
      .mockResolvedValue({ name: 't2', label: 'T2', status: 'pass', message: 'ok' });

    const tasks: DiagnosticTask[] = [
      {
        name: 't1',
        label: 'T1',
        run: async () => ({ name: 't1', label: 'T1', status: 'fail', message: 'failed' }),
      },
      {
        name: 't2',
        label: 'T2',
        dependsOn: ['t1'],
        run: runSpy,
      },
    ];

    const results = await runDiagnosticTasks(tasks);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('fail');

    expect(results[1].status).toBe('skip');
    expect(results[1].message).toBe('Skipped (depends on t1)');

    // The actual run function should never have been called!
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('cascades skips through multiple layers of dependencies', async () => {
    const runSpy3 = vi.fn();
    const tasks: DiagnosticTask[] = [
      {
        name: 't1',
        label: 'T1',
        run: async () => ({ name: 't1', label: 'T1', status: 'fail', message: 'failed' }),
      },
      {
        name: 't2',
        label: 'T2',
        dependsOn: ['t1'],
        run: async () => ({ name: 't2', label: 'T2', status: 'pass', message: 'ok' }),
      },
      { name: 't3', label: 'T3', dependsOn: ['t2'], run: runSpy3 },
    ];

    const results = await runDiagnosticTasks(tasks);
    expect(results).toHaveLength(3);
    expect(results[1].status).toBe('skip');
    expect(results[2].status).toBe('skip');
    expect(results[2].message).toBe('Skipped (depends on t2)');
    expect(runSpy3).not.toHaveBeenCalled();
  });
});
