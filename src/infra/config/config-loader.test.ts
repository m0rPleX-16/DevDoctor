/**
 * Config Loader Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('node:fs');

// Import after mock
import { loadConfig } from './config-loader.js';

describe('config-loader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  describe('loadConfig', () => {
    it('returns all defaults when no config files exist', () => {
      const config = loadConfig();

      expect(config.defaultFormat).toBe('terminal');
      expect(config.reportOutputDir).toBe(process.cwd());
      expect(config.plugins).toEqual({});
    });

    it('applies project config over defaults', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('devdoctor.json'));
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ defaultFormat: 'json' }));

      const config = loadConfig();
      expect(config.defaultFormat).toBe('json');
    });

    it('merges user and project configs, project wins', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        if (String(p).includes('.devdoctor')) {
          return JSON.stringify({ defaultFormat: 'markdown', reportOutputDir: '/user/reports' });
        }
        return JSON.stringify({ defaultFormat: 'json' });
      });

      const config = loadConfig();
      expect(config.defaultFormat).toBe('json'); // project wins
      expect(config.reportOutputDir).toBe('/user/reports'); // user value preserved
    });

    it('ignores invalid defaultFormat and uses default', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('devdoctor.json'));
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ defaultFormat: 'xml' }));

      const config = loadConfig();
      expect(config.defaultFormat).toBe('terminal'); // falls back to default
    });

    it('handles malformed JSON gracefully without throwing', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('devdoctor.json'));
      vi.mocked(fs.readFileSync).mockReturnValue('{ not valid json }');

      expect(() => loadConfig()).not.toThrow();
      const config = loadConfig();
      expect(config.defaultFormat).toBe('terminal');
    });

    it('reads plugin disabled flags', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('devdoctor.json'));
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ plugins: { mysql: { disabled: true } } }),
      );

      const config = loadConfig();
      expect(config.plugins['mysql']?.disabled).toBe(true);
      expect(config.plugins['node']).toBeUndefined();
    });
  });
});
