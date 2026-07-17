/**
 * Tests for PDF report export (#23)
 */
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

import puppeteer from 'puppeteer-core';
import { savePdfReport } from '../pdf';
import type { ParsedResults } from '../reporter';
import type { WcagLevel } from '../filter';
import { rmSync, existsSync } from 'fs';

const base: ParsedResults = {
  url: 'https://example.com',
  level: 'AA' as WcagLevel,
  violations: [],
  passes: 10,
  incomplete: 0,
  timestamp: '2024-01-01T00:00:00.000Z',
};

function makePdfBrowser(pdfBuffer = Buffer.from('%PDF-test')) {
  const page = {
    setContent: jest.fn().mockResolvedValue(undefined),
    pdf: jest.fn().mockResolvedValue(pdfBuffer),
  };
  return {
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined),
    _page: page,
  };
}

describe('savePdfReport', () => {
  const tmpDir = '/tmp/a11y-pdf-test';
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  test('returns path ending in .pdf', async () => {
    const browser = makePdfBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);
    const path = await savePdfReport(base, tmpDir);
    expect(path.endsWith('.pdf')).toBe(true);
  });

  test('creates PDF file on disk', async () => {
    const browser = makePdfBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);
    const path = await savePdfReport(base, tmpDir);
    expect(existsSync(path)).toBe(true);
  });

  test('closes browser even on error', async () => {
    const browser = makePdfBrowser();
    browser._page.pdf.mockRejectedValue(new Error('pdf failed'));
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);
    await expect(savePdfReport(base, tmpDir)).rejects.toThrow('pdf failed');
    expect(browser.close).toHaveBeenCalled();
  });

  test('calls page.pdf with A4 format', async () => {
    const browser = makePdfBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);
    await savePdfReport(base, tmpDir);
    expect(browser._page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'A4', printBackground: true })
    );
  });

  test('includes timestamp in filename', async () => {
    const browser = makePdfBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);
    const path = await savePdfReport(base, tmpDir);
    expect(path).toContain('2024');
  });
});
