import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SnapshotManager } from './snapshot-manager.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ── Helpers ───────────────────────────────────────────────────────

/** Create a fresh temp directory for each test so tests never touch ~/.devdoctor. */
function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devdoctor-snapshot-test-'));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── Tests ─────────────────────────────────────────────────────────

describe('SnapshotManager', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(tmpDir);
  });

  // ── Basic CRUD ────────────────────────────────────────────────

  it('returns null when no snapshot exists', () => {
    const manager = new SnapshotManager(tmpDir);
    expect(manager.getLatestSnapshot()).toBeNull();
  });

  it('records a repair and retrieves it', () => {
    const manager = new SnapshotManager(tmpDir);

    manager.recordRepair('mysql', 'mysql-service');

    const snapshot = manager.getLatestSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.repairs).toHaveLength(1);
    expect(snapshot?.repairs[0].plugin).toBe('mysql');
    expect(snapshot?.repairs[0].checkName).toBe('mysql-service');
    expect(typeof snapshot?.repairs[0].timestamp).toBe('string');
  });

  it('appends multiple repairs to the same snapshot', () => {
    const manager = new SnapshotManager(tmpDir);

    manager.recordRepair('mysql', 'mysql-service');
    manager.recordRepair('node', 'node-permissions');

    const snapshot = manager.getLatestSnapshot();
    expect(snapshot?.repairs).toHaveLength(2);
    expect(snapshot?.repairs[1].plugin).toBe('node');
    expect(snapshot?.repairs[1].checkName).toBe('node-permissions');
  });

  it('clears the snapshot', () => {
    const manager = new SnapshotManager(tmpDir);
    manager.recordRepair('mysql', 'mysql-service');
    expect(manager.getLatestSnapshot()).not.toBeNull();

    manager.clearSnapshot();
    expect(manager.getLatestSnapshot()).toBeNull();
  });

  it('clearSnapshot is a no-op when no snapshot exists', () => {
    const manager = new SnapshotManager(tmpDir);
    expect(() => manager.clearSnapshot()).not.toThrow();
    expect(manager.getLatestSnapshot()).toBeNull();
  });

  // ── Resilience ────────────────────────────────────────────────

  it('recovers gracefully from a corrupted snapshot file', () => {
    const manager = new SnapshotManager(tmpDir);
    const snapshotPath = path.join(tmpDir, 'latest.json');

    // Write malformed JSON to simulate a crash mid-write
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(snapshotPath, '{ "version": 1, "repairs": [{ "plugin": "mysql"', 'utf-8');

    // getLatestSnapshot must return null, not throw
    expect(manager.getLatestSnapshot()).toBeNull();
  });

  it('starts a fresh snapshot after a corrupted file', () => {
    const manager = new SnapshotManager(tmpDir);
    const snapshotPath = path.join(tmpDir, 'latest.json');

    // Corrupt the existing file
    fs.writeFileSync(snapshotPath, 'NOT JSON', 'utf-8');

    // recordRepair should recover from the corruption and write a clean manifest
    manager.recordRepair('python', 'python-venv');

    const snapshot = manager.getLatestSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.repairs).toHaveLength(1);
    expect(snapshot?.repairs[0].plugin).toBe('python');
  });

  it('creates intermediate directories automatically', () => {
    // Use a nested path that does not yet exist
    const nestedDir = path.join(tmpDir, 'a', 'b', 'c');
    const manager = new SnapshotManager(nestedDir);

    expect(() => manager.recordRepair('node', 'node-permissions')).not.toThrow();
    expect(manager.getLatestSnapshot()?.repairs).toHaveLength(1);
  });

  // ── Two-instance writes (simulated concurrent writes) ─────────

  it('second instance appends rather than overwrites when written sequentially', () => {
    // Simulate two separate RepairEngine instances writing to the same snapshot dir.
    // In practice these are sequential (single-process), but the test confirms
    // that a new SnapshotManager instance does not reset existing data.
    const managerA = new SnapshotManager(tmpDir);
    const managerB = new SnapshotManager(tmpDir);

    managerA.recordRepair('mysql', 'mysql-service');
    managerB.recordRepair('node', 'node-permissions');

    // Both managers share the same path — B should have appended to A's data
    const snapshot = managerB.getLatestSnapshot();
    expect(snapshot?.repairs).toHaveLength(2);
    expect(snapshot?.repairs[0].plugin).toBe('mysql');
    expect(snapshot?.repairs[1].plugin).toBe('node');
  });
});
