import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface RepairRecord {
  plugin: string;
  checkName: string;
  timestamp: string;
}

export interface SnapshotManifest {
  version: 1;
  repairs: RepairRecord[];
}

/**
 * SnapshotManager
 *
 * Persists a record of all successful repairs that support rollback.
 * This allows the user to run `devdoctor rollback` at any time to
 * undo the repairs applied in the previous session.
 */
export class SnapshotManager {
  private snapshotPath: string;

  constructor(snapshotDir?: string) {
    const dir = snapshotDir ?? path.join(os.homedir(), '.devdoctor', 'snapshots');
    this.snapshotPath = path.join(dir, 'latest.json');
  }

  /**
   * Appends a repair to the current snapshot manifest.
   */
  recordRepair(plugin: string, checkName: string): void {
    let manifest: SnapshotManifest = { version: 1, repairs: [] };
    
    if (fs.existsSync(this.snapshotPath)) {
      try {
        const data = fs.readFileSync(this.snapshotPath, 'utf-8');
        manifest = JSON.parse(data) as SnapshotManifest;
      } catch (e) {
        // Corrupted snapshot, start fresh
      }
    } else {
      fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });
    }

    manifest.repairs.push({
      plugin,
      checkName,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(this.snapshotPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Gets the current snapshot manifest, or null if none exists.
   */
  getLatestSnapshot(): SnapshotManifest | null {
    if (!fs.existsSync(this.snapshotPath)) {
      return null;
    }
    try {
      const data = fs.readFileSync(this.snapshotPath, 'utf-8');
      return JSON.parse(data) as SnapshotManifest;
    } catch {
      return null;
    }
  }

  /**
   * Clears the current snapshot manifest.
   */
  clearSnapshot(): void {
    if (fs.existsSync(this.snapshotPath)) {
      fs.unlinkSync(this.snapshotPath);
    }
  }
}
