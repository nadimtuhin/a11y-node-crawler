import { filterByLevel, parseResults, WcagLevel } from '../filter';
import type { AxeResults, Result } from 'axe-core';

// Minimal Result stub
function makeViolation(id: string, tags: string[], impact: 'critical' | 'serious' | 'moderate' | 'minor' = 'serious'): Result {
  return {
    id,
    impact,
    tags,
    description: `Test violation ${id}`,
    help: id,
    helpUrl: `https://example.com/${id}`,
    nodes: [{ html: '<div>', target: ['.x'], any: [], all: [], none: [], failureSummary: '' }],
  } as unknown as Result;
}

function makeAxeResults(violations: Result[]): AxeResults {
  return {
    url: 'https://example.com',
    violations,
    passes: [makeViolation('pass1', ['wcag2a'])],
    incomplete: [],
    inapplicable: [],
    timestamp: new Date().toISOString(),
  } as unknown as AxeResults;
}

describe('filterByLevel', () => {
  const vA   = makeViolation('v-a',   ['wcag2a']);
  const vAA  = makeViolation('v-aa',  ['wcag2aa']);
  const vAAA = makeViolation('v-aaa', ['wcag2aaa']);
  const vNone = makeViolation('v-best', ['best-practice']);

  test('level A returns only wcag2a violations', () => {
    const result = filterByLevel([vA, vAA, vAAA, vNone], 'A');
    expect(result.map((r) => r.id)).toEqual(['v-a']);
  });

  test('level AA returns A and AA violations', () => {
    const result = filterByLevel([vA, vAA, vAAA, vNone], 'AA');
    expect(result.map((r) => r.id)).toContain('v-a');
    expect(result.map((r) => r.id)).toContain('v-aa');
    expect(result.map((r) => r.id)).not.toContain('v-aaa');
    expect(result.map((r) => r.id)).not.toContain('v-best');
  });

  test('level AAA returns A, AA, and AAA violations', () => {
    const result = filterByLevel([vA, vAA, vAAA, vNone], 'AAA');
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(['v-a', 'v-aa', 'v-aaa']));
    expect(result.map((r) => r.id)).not.toContain('v-best');
  });

  test('empty violations returns empty array', () => {
    expect(filterByLevel([], 'AA')).toEqual([]);
  });

  test('violation with multiple tags matched on any', () => {
    const v = makeViolation('multi', ['best-practice', 'wcag2aa']);
    expect(filterByLevel([v], 'AA')).toHaveLength(1);
  });
});

describe('parseResults', () => {
  const violations = [
    makeViolation('v1', ['wcag2a']),
    makeViolation('v2', ['wcag2aa']),
    makeViolation('v3', ['wcag2aaa']),
  ];

  test('default level is AA', () => {
    const parsed = parseResults(makeAxeResults(violations));
    expect(parsed.level).toBe('AA');
    expect(parsed.violations.map((v) => v.id)).toContain('v1');
    expect(parsed.violations.map((v) => v.id)).toContain('v2');
    expect(parsed.violations.map((v) => v.id)).not.toContain('v3');
  });

  test('exposes url, passes, incomplete, timestamp', () => {
    const parsed = parseResults(makeAxeResults(violations), 'AA');
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.passes).toBe(1);
    expect(parsed.incomplete).toBe(0);
    expect(parsed.timestamp).toBeTruthy();
  });

  test('level A narrows further', () => {
    const parsed = parseResults(makeAxeResults(violations), 'A');
    expect(parsed.violations).toHaveLength(1);
    expect(parsed.violations[0].id).toBe('v1');
  });
});
