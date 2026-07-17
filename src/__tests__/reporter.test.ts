import { toPlainText, toHtml, toCsv, saveReport, sendWebhook, ParsedResults } from '../reporter';
import { WcagLevel } from '../filter';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Result } from 'axe-core';

function makeViolation(id: string, impact = 'serious'): Result {
  return {
    id,
    impact,
    tags: ['wcag2aa'],
    description: `Test ${id}`,
    help: id,
    helpUrl: `https://example.com/${id}`,
    nodes: [{ html: '<div>', target: ['.x'], any: [], all: [], none: [], failureSummary: '' }],
  } as unknown as Result;
}

const baseData: ParsedResults = {
  url: 'https://example.com',
  level: 'AA' as WcagLevel,
  violations: [makeViolation('color-contrast')],
  passes: 10,
  incomplete: 2,
  timestamp: '2024-01-01T00:00:00.000Z',
};

describe('toPlainText', () => {
  test('contains header and summary', () => {
    const text = toPlainText(baseData);
    expect(text).toContain('A11y Scan Report');
    expect(text).toContain('https://example.com');
    expect(text).toContain('Violations: 1');
    expect(text).toContain('Passes:     10');
  });

  test('lists violation id and help url', () => {
    const text = toPlainText(baseData);
    expect(text).toContain('color-contrast');
    expect(text).toContain('https://example.com/color-contrast');
  });

  test('no-violations message when empty', () => {
    const text = toPlainText({ ...baseData, violations: [] });
    expect(text).toContain('No violations found');
  });
});

describe('toHtml', () => {
  test('returns valid HTML with summary stats', () => {
    const html = toHtml(baseData);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('color-contrast');
    expect(html).toContain('https://example.com');
  });

  test('no-violations path renders success message', () => {
    const html = toHtml({ ...baseData, violations: [] });
    expect(html).toContain('No violations found');
  });
});

describe('toCsv', () => {
  test('contains header row', () => {
    const csv = toCsv(baseData);
    expect(csv.startsWith('id,impact,description,nodes,helpUrl')).toBe(true);
  });

  test('contains violation row', () => {
    const csv = toCsv(baseData);
    expect(csv).toContain('color-contrast');
    expect(csv).toContain('serious');
  });

  test('header only when no violations', () => {
    const csv = toCsv({ ...baseData, violations: [] });
    expect(csv.trim()).toBe('id,impact,description,nodes,helpUrl');
  });

  test('escapes double quotes in description', () => {
    const v = makeViolation('test-rule');
    (v as any).description = 'Has "quotes"';
    const csv = toCsv({ ...baseData, violations: [v] });
    expect(csv).toContain('"Has ""quotes"""');
  });
});

describe('saveReport csv', () => {
  const tmpDir = '/tmp/a11y-csv-reports';
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  test('saves CSV file', () => {
    const path = saveReport(baseData, 'csv', tmpDir);
    expect(path.endsWith('.csv')).toBe(true);
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('id,impact');
    expect(content).toContain('color-contrast');
  });

  // Security: file size limit (#31)
  test('throws when report exceeds maxBytes', () => {
    expect(() => saveReport(baseData, 'json', tmpDir, 10)).toThrow('exceeds max size');
  });
});


describe('saveReport json/html', () => {
  const tmpDir = '/tmp/a11y-test-reports';

  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  test('saves JSON file and returns path', () => {
    const path = saveReport(baseData, 'json', tmpDir);
    expect(existsSync(path)).toBe(true);
    const content = JSON.parse(readFileSync(path, 'utf8'));
    expect(content.url).toBe('https://example.com');
    expect(content.violations).toHaveLength(1);
  });

  test('saves HTML file', () => {
    const path = saveReport(baseData, 'html', tmpDir);
    expect(path.endsWith('.html')).toBe(true);
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('<!DOCTYPE html>');
  });

  test('creates reports dir if missing', () => {
    const nested = join(tmpDir, 'deep/nested');
    const path = saveReport(baseData, 'json', nested);
    expect(existsSync(path)).toBe(true);
  });
});

describe('sendWebhook', () => {
  const origFetch = global.fetch;
  afterEach(() => { global.fetch = origFetch; });

  test('POSTs JSON to webhook URL', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    global.fetch = mockFetch as any;

    await sendWebhook('https://hooks.example.com/test', baseData);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.example.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('https://example.com');
    expect(body.text).toContain('violation');
  });

  test('throws on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request' }) as any;
    await expect(sendWebhook('https://hooks.example.com/test', baseData)).rejects.toThrow('400');
  });

  test('no-violation report uses success emoji', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    global.fetch = mockFetch as any;
    await sendWebhook('https://hooks.example.com/test', { ...baseData, violations: [] });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('✅');
  });

  // Security: HTTPS enforcement + credential masking (#33)
  test('rejects non-https webhook URLs', async () => {
    await expect(sendWebhook('http://hooks.example.com/test', baseData)).rejects.toThrow('HTTPS');
  });

  test('rejects invalid webhook URL', async () => {
    await expect(sendWebhook('not-a-url', baseData)).rejects.toThrow('Invalid webhook URL');
  });

  test('masks credentials in error message on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' }) as any;
    // URL with embedded credentials — must not appear in thrown error
    await expect(
      sendWebhook('https://user:secret@hooks.example.com/test', baseData)
    ).rejects.toThrow(expect.objectContaining({ message: expect.not.stringContaining('secret') }));
  });
});
