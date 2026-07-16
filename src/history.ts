/**
 * SQLite-backed scan history using better-sqlite3.
 * Stores one row per scan: url, timestamp, violation counts by impact.
 */
import Database from 'better-sqlite3';
import { join } from 'path';
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

export function openDb(dbPath?: string): Database.Database {
  const p = dbPath ?? join(process.cwd(), 'history.db');
  const db = new Database(p);
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
