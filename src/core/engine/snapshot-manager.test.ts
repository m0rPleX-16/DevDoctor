import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SnapshotManager } from './snapshot-manager.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('SnapshotManager', () => {
  const snapshotPath = path.join(os.homedir(), '.devdoctor', 'snapshots', 'latest.json');

  beforeEach(() => {
    if (fs.existsSync(snapshotPath)) {
      fs.unlinkSync(snapshotPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(snapshotPath)) {
      fs.unlinkSync(snapshotPath);
    }
  });

  it('records a repair and retrieves it', () => {
    const manager = new SnapshotManager();
    expect(manager.getLatestSnapshot()).toBeNull();

    manager.recordRepair('mysql', 'mysql-service');

    const snapshot = manager.getLatestSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.repairs).toHaveLength(1);
    expect(snapshot?.repairs[0].plugin).toBe('mysql');
    expect(snapshot?.repairs[0].checkName).toBe('mysql-service');
  });

  it('appends multiple repairs to the same snapshot', () => {
    const manager = new SnapshotManager();

    manager.recordRepair('mysql', 'mysql-service');
    manager.recordRepair('node', 'node-permissions');

    const snapshot = manager.getLatestSnapshot();
    expect(snapshot?.repairs).toHaveLength(2);
    expect(snapshot?.repairs[1].plugin).toBe('node');
  });

  it('clears the snapshot', () => {
    const manager = new SnapshotManager();
    manager.recordRepair('mysql', 'mysql-service');
    expect(manager.getLatestSnapshot()).not.toBeNull();

    manager.clearSnapshot();
    expect(manager.getLatestSnapshot()).toBeNull();
  });
});
