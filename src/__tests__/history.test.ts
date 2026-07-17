import { openDb, logScan, getHistory, validateDbPath } from '../history';
import { rmSync } from 'fs';
import { join } from 'path';
import type { AxeResults } from 'axe-core';

const dbPath = join('/tmp', `a11y-history-test-${Date.now()}.db`);

afterAll(() => rmSync(dbPath, { force: true }));

function makeResults(url: string, violations: { impact: string }[] = []): AxeResults {
  return {
    url,
    violations: violations.map(v => ({ impact: v.impact as any, id: 'x', tags: [], description: '', help: '', helpUrl: '', nodes: [] })),
    passes: [],
    incomplete: [],
    inapplicable: [],
    testEngine: { name: 'axe-core', version: '0' },
    testRunner: { name: 'axe' },
    testEnvironment: { userAgent: '', windowWidth: 0, windowHeight: 0, orientationAngle: 0, orientationType: '' },
    timestamp: new Date().toISOString(),
    toolOptions: {},
  };
}

describe('history', () => {
  test('openDb creates table', () => {
    const db = openDb(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.map((t: any) => t.name)).toContain('scan_history');
    db.close();
  });

  test('logScan inserts row and returns it', () => {
    const db = openDb(dbPath);
    const results = makeResults('https://example.com', [
      { impact: 'critical' },
      { impact: 'serious' },
      { impact: 'critical' },
    ]);
    const row = logScan(db, results);
    expect(row.url).toBe('https://example.com');
    expect(row.critical).toBe(2);
    expect(row.serious).toBe(1);
    expect(row.total).toBe(3);
    db.close();
  });

  test('getHistory returns all rows', () => {
    const db = openDb(dbPath);
    logScan(db, makeResults('https://a.com'));
    logScan(db, makeResults('https://b.com'));
    const rows = getHistory(db);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    db.close();
  });

  test('getHistory filters by url', () => {
    const db = openDb(dbPath);
    logScan(db, makeResults('https://filter-test.com'));
    const rows = getHistory(db, 'https://filter-test.com');
    expect(rows.every(r => r.url === 'https://filter-test.com')).toBe(true);
    db.close();
  });

  // Security: prepared statements prevent SQL injection (#24)
  test('getHistory is safe against SQL injection in url parameter', () => {
    const db = openDb(dbPath);
    logScan(db, makeResults('https://safe.com'));
    // Malicious input — should return empty, not error or dump all rows
    const rows = getHistory(db, "' OR '1'='1");
    expect(rows).toEqual([]);
    db.close();
  });
});

describe('validateDbPath', () => {
  test('returns resolved path for valid input', () => {
    const result = validateDbPath('/tmp/test.db');
    expect(result).toBe('/tmp/test.db');
  });

  test('normalizes path traversal components', () => {
    const result = validateDbPath('/tmp/../tmp/test.db');
    expect(result).toBe('/tmp/test.db');
  });

  test('throws when path escapes allowedBase', () => {
    expect(() => validateDbPath('/etc/passwd', '/tmp')).toThrow('outside allowed directory');
  });

  test('allows path within allowedBase', () => {
    const result = validateDbPath('/tmp/test.db', '/tmp');
    expect(result).toBe('/tmp/test.db');
  });
});
