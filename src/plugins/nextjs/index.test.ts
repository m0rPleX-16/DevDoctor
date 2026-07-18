import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { NextjsPlugin } from './index.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    appendFileSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));

describe('NextjsPlugin Repairs', () => {
  let plugin: NextjsPlugin;

  beforeEach(() => {
    vi.resetAllMocks();
    plugin = new NextjsPlugin();
  });

  it('canRepair should return true for supported checks', () => {
    expect(plugin.canRepair('nextjs-env-local')).toBe(true);
    expect(plugin.canRepair('nextjs-cache-staleness')).toBe(true);
    expect(plugin.canRepair('other-check')).toBe(false);
  });

  it('repair should create .env.local', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false); // mock gitignore missing

    const result = await plugin.repair('nextjs-env-local');
    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('repair should clear .next/cache', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await plugin.repair('nextjs-cache-staleness');
    expect(result.success).toBe(true);
    expect(fs.rmSync).toHaveBeenCalled();
  });
});
