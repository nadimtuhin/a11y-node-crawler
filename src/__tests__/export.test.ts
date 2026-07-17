/**
 * Tests for Markdown/XML export pipelines (#14)
 */
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

import { toMarkdown, toXml, saveReport, ParsedResults } from '../reporter';
import { WcagLevel } from '../filter';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import type { Result } from 'axe-core';

function makeViolation(id: string): Result {
  return {
    id,
    impact: 'serious',
    tags: ['wcag2aa'],
    description: `Test ${id} with <special> chars & "quotes"`,
    help: id,
    helpUrl: `https://example.com/${id}`,
    nodes: [{ html: '<div>', target: ['.x'], any: [], all: [], none: [], failureSummary: '' }],
  } as unknown as Result;
}

const base: ParsedResults = {
  url: 'https://example.com',
  level: 'AA' as WcagLevel,
  violations: [makeViolation('color-contrast')],
  passes: 5,
  incomplete: 1,
  timestamp: '2024-01-01T00:00:00.000Z',
};

describe('toMarkdown', () => {
  test('contains markdown heading', () => {
    const md = toMarkdown(base);
    expect(md).toContain('# A11y Scan Report');
  });

  test('contains URL in table', () => {
    const md = toMarkdown(base);
    expect(md).toContain('https://example.com');
  });

  test('lists violations section', () => {
    const md = toMarkdown(base);
    expect(md).toContain('## Violations');
    expect(md).toContain('color-contrast');
  });

  test('no-violations shows success message', () => {
    const md = toMarkdown({ ...base, violations: [] });
    expect(md).toContain('✅');
    expect(md).not.toContain('## Violations');
  });
});

describe('toXml', () => {
  test('starts with XML declaration', () => {
    const xml = toXml(base);
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
  });

  test('wraps in a11yReport element', () => {
    const xml = toXml(base);
    expect(xml).toContain('<a11yReport>');
    expect(xml).toContain('</a11yReport>');
  });

  test('escapes special chars in description', () => {
    const xml = toXml(base);
    expect(xml).toContain('&lt;special&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;quotes&quot;');
  });

  test('includes summary attributes', () => {
    const xml = toXml(base);
    expect(xml).toContain('violations="1"');
    expect(xml).toContain('passes="5"');
  });

  test('no-violations has empty violations element', () => {
    const xml = toXml({ ...base, violations: [] });
    expect(xml).toContain('<violations>');
    expect(xml).not.toContain('<violation ');
  });
});

describe('saveReport md/xml', () => {
  const tmpDir = '/tmp/a11y-md-xml-test';
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  test('saves .md file', () => {
    const path = saveReport(base, 'md', tmpDir);
    expect(path.endsWith('.md')).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toContain('# A11y Scan Report');
  });

  test('saves .xml file', () => {
    const path = saveReport(base, 'xml', tmpDir);
    expect(path.endsWith('.xml')).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toContain('<a11yReport>');
  });
});
