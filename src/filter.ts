import type { AxeResults, Result } from 'axe-core';

export type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * Map WCAG level to the set of axe tags to include.
 * Each level is cumulative: AA includes A, AAA includes AA+A.
 */
const LEVEL_TAGS: Record<WcagLevel, string[]> = {
  A:   ['wcag2a', 'wcag21a'],
  AA:  ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
  AAA: ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'wcag2aaa'],
};

export function filterByLevel(violations: Result[], level: WcagLevel): Result[] {
  const allowed = new Set(LEVEL_TAGS[level]);
  return violations.filter((v) =>
    v.tags.some((tag) => allowed.has(tag))
  );
}

export function parseResults(raw: AxeResults, level: WcagLevel = 'AA'): {
  url: string;
  level: WcagLevel;
  violations: Result[];
  passes: number;
  incomplete: number;
  timestamp: string;
} {
  return {
    url: raw.url,
    level,
    violations: filterByLevel(raw.violations, level),
    passes: raw.passes.length,
    incomplete: raw.incomplete.length,
    timestamp: new Date().toISOString(),
  };
}
