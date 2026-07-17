// Mock puppeteer-core before imports
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

import puppeteer from 'puppeteer-core';
import { captureViolationScreenshots, capturePageScreenshot } from '../screenshots';
import type { AxeResults } from 'axe-core';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

const TMP = join(os.tmpdir(), `a11y-screenshots-test-${Date.now()}`);

function makeMockPage(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    setViewport: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(undefined),
    $: jest.fn().mockResolvedValue(null),        // no elements found → no screenshots
    screenshot: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMockBrowser(page: ReturnType<typeof makeMockPage>) {
  return {
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

const EMPTY_AXE: AxeResults = {
  url: 'https://example.com',
  violations: [],
  passes: [],
  incomplete: [],
  inapplicable: [],
  timestamp: new Date().toISOString(),
  testEngine: { name: 'axe-core', version: '4.0.0' },
  testEnvironment: { userAgent: '', windowWidth: 0, windowHeight: 0, orientationAngle: 0, orientationType: '' },
  testRunner: { name: 'axe' },
  toolOptions: {},
};

const AXE_WITH_VIOLATIONS: AxeResults = {
  ...EMPTY_AXE,
  violations: [
    {
      id: 'color-contrast',
      impact: 'serious',
      description: 'Ensures foreground and background colors have sufficient contrast',
      help: 'Elements must have sufficient color contrast',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
      tags: ['wcag2aa'],
      nodes: [
        {
          html: '<button>click</button>',
          impact: 'serious',
          target: ['button.bad-contrast'],
          any: [], all: [], none: [],
          failureSummary: '',
        },
      ],
    },
  ],
};

beforeAll(() => mkdirSync(TMP, { recursive: true }));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
afterEach(() => jest.clearAllMocks());

describe('captureViolationScreenshots', () => {
  test('returns empty array when no violations', async () => {
    const results = await captureViolationScreenshots('https://example.com', EMPTY_AXE, TMP);
    // No browser launched — no violations means early return
    expect(results).toEqual([]);
    expect(puppeteer.launch).not.toHaveBeenCalled();
  });

  test('launches browser for violations, handles null element gracefully', async () => {
    const page = makeMockPage({ $: jest.fn().mockResolvedValue(null) });
    const browser = makeMockBrowser(page);
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    const results = await captureViolationScreenshots('https://example.com', AXE_WITH_VIOLATIONS, TMP);

    expect(puppeteer.launch).toHaveBeenCalledWith(expect.objectContaining({ headless: true }));
    expect(page.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    // element returned null so no screenshots captured, but no error
    expect(results).toEqual([]);
    expect(browser.close).toHaveBeenCalled();
  });

  test('captures screenshot when element found', async () => {
    const mockElement = { screenshot: jest.fn().mockResolvedValue(undefined) };
    const page = makeMockPage({ $: jest.fn().mockResolvedValue(mockElement) });
    const browser = makeMockBrowser(page);
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    const results = await captureViolationScreenshots('https://example.com', AXE_WITH_VIOLATIONS, TMP);

    expect(mockElement.screenshot).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].violationId).toBe('color-contrast');
    expect(results[0].nodeIndex).toBe(0);
    expect(results[0].selector).toBe('button.bad-contrast');
    expect(results[0].path).toContain('color-contrast_node0.png');
  });

  test('closes browser even when goto throws', async () => {
    const page = makeMockPage({ goto: jest.fn().mockRejectedValue(new Error('nav fail')) });
    const browser = makeMockBrowser(page);
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    await expect(
      captureViolationScreenshots('https://example.com', AXE_WITH_VIOLATIONS, TMP)
    ).rejects.toThrow('nav fail');
    expect(browser.close).toHaveBeenCalled();
  });
});

describe('capturePageScreenshot', () => {
  test('captures full-page screenshot and returns path', async () => {
    const page = makeMockPage({ screenshot: jest.fn().mockResolvedValue(undefined) });
    const browser = makeMockBrowser(page);
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    const path = await capturePageScreenshot('https://example.com', TMP);

    expect(page.screenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: true }));
    expect(typeof path).toBe('string');
    expect(path).toContain('fullpage_');
    expect(browser.close).toHaveBeenCalled();
  });

  test('closes browser on error', async () => {
    const page = makeMockPage({ goto: jest.fn().mockRejectedValue(new Error('boom')) });
    const browser = makeMockBrowser(page);
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    await expect(capturePageScreenshot('https://example.com', TMP)).rejects.toThrow('boom');
    expect(browser.close).toHaveBeenCalled();
  });
});

// Security: path traversal + command injection (#26, #28)
import { validateChromePath, safeDirPath } from '../screenshots';

describe('validateChromePath', () => {
  test('accepts valid absolute paths', () => {
    expect(() => validateChromePath('/usr/bin/google-chrome')).not.toThrow();
  });

  test('rejects relative paths', () => {
    expect(() => validateChromePath('google-chrome')).toThrow('absolute');
  });

  test('rejects paths with shell metacharacters', () => {
    expect(() => validateChromePath('/usr/bin/chrome; rm -rf /')).toThrow('unsafe');
    expect(() => validateChromePath('/usr/bin/chrome`id`')).toThrow('unsafe');
    expect(() => validateChromePath('/usr/bin/chrome|bash')).toThrow('unsafe');
  });
});

describe('safeDirPath', () => {
  test('resolves valid dir', () => {
    const p = safeDirPath('/tmp/screenshots');
    expect(p).toBe('/tmp/screenshots');
  });

  test('normalizes traversal components', () => {
    const p = safeDirPath('/tmp/../tmp/screenshots');
    expect(p).toBe('/tmp/screenshots');
  });

  test('throws on traversal outside allowedBase', () => {
    expect(() => safeDirPath('/etc/cron.d', '/tmp')).toThrow('outside allowed base');
  });
});
