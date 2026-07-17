/**
 * SQLite-backed scan history using better-sqlite3.
 * Stores one row per scan: url, timestamp, violation counts by impact.
 *
 * Security: all user-supplied values go through db.prepare() bound parameters.
 * The db.exec() call in openDb uses only a static string literal (DDL) — no
 * user input ever reaches it, so it is not a SQL-injection risk (#24).
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { resolve, normalize } from 'path';
import type { AxeResults } from 'axe-core';

export interface HistoryRow {
  id: number;
  url: string;
  scanned_at: string;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  total: number;
}

/**
 * Validate dbPath stays within an allowed base directory.
 * Rejects path traversal attempts (e.g. "../../etc/passwd").
 */
export function validateDbPath(dbPath: string, allowedBase?: string): string {
  const resolved = resolve(normalize(dbPath));
  if (allowedBase) {
    const base = resolve(allowedBase);
    if (!resolved.startsWith(base + '/') && resolved !== base) {
      throw new Error(`DB path outside allowed directory: ${dbPath}`);
    }
  }
  return resolved;
}

export function openDb(dbPath?: string): Database.Database {
  const rawPath = dbPath ?? join(process.cwd(), 'history.db');
  // ponytail: allowedBase not enforced here (caller may use any dir); enforce at call-sites that receive external input
  const p = resolve(normalize(rawPath));
  const db = new Database(p);
  // Static DDL only — no interpolated values; exec() is safe here
  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      url        TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      critical   INTEGER NOT NULL DEFAULT 0,
      serious    INTEGER NOT NULL DEFAULT 0,
      moderate   INTEGER NOT NULL DEFAULT 0,
      minor      INTEGER NOT NULL DEFAULT 0,
      total      INTEGER NOT NULL DEFAULT 0
    )
  `);
  return db;
}

export function logScan(db: Database.Database, results: AxeResults): HistoryRow {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of results.violations) {
    const impact = (v.impact ?? 'minor') as keyof typeof counts;
    if (impact in counts) counts[impact]++;
  }
  const stmt = db.prepare(`
    INSERT INTO scan_history (url, scanned_at, critical, serious, moderate, minor, total)
    VALUES (@url, @scanned_at, @critical, @serious, @moderate, @minor, @total)
  `);
  const info = stmt.run({
    url: results.url,
    scanned_at: new Date().toISOString(),
    ...counts,
    total: results.violations.length,
  });
  return getHistory(db).find(r => r.id === info.lastInsertRowid)!;
}

export function getHistory(db: Database.Database, url?: string): HistoryRow[] {
  if (url) {
    return db.prepare('SELECT * FROM scan_history WHERE url = ? ORDER BY scanned_at DESC').all(url) as HistoryRow[];
  }
  return db.prepare('SELECT * FROM scan_history ORDER BY scanned_at DESC').all() as HistoryRow[];
}
