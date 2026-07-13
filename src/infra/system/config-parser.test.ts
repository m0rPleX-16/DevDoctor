import { describe, it, expect } from 'vitest';
import { parseIni } from './config-parser.js';

describe('config-parser', () => {
  it('should parse INI key value strings properly', () => {
    const iniContent = `
      # Mysqld Server Config
      [mysqld]
      port = 3306
      basedir = "C:/mysql"
      datadir = 'C:/mysql/data' # data directory path
      
      [client]
      default-character-set=utf8
    `;

    const config = parseIni(iniContent);

    expect(config.mysqld).toBeDefined();
    expect(config.mysqld.port).toBe('3306');
    expect(config.mysqld.basedir).toBe('C:/mysql');
    expect(config.mysqld.datadir).toBe('C:/mysql/data');

    expect(config.client).toBeDefined();
    expect(config.client['default-character-set']).toBe('utf8');
  });

  it('should return empty object for empty or comment-only string', () => {
    const content = `
      # Just comments
      ; Another comment
    `;

    const config = parseIni(content);
    expect(config).toEqual({});
  });
});
