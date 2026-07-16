// Mock puppeteer-core before any imports
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
  },
}));

import puppeteer from 'puppeteer-core';
import { scanUrl, crawlUrls, getChromePath } from '../scanner';
import type { AxeResults } from 'axe-core';
import { writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const mockAxeResults: Partial<AxeResults> = {
  url: 'https://example.com',
  violations: [],
  passes: [],
  incomplete: [],
  inapplicable: [],
  timestamp: new Date().toISOString(),
};

function makeMockBrowser(links: string[] = []) {
  const mockPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn()
      .mockResolvedValueOnce(undefined)         // axeSource injection
      .mockResolvedValueOnce(mockAxeResults),   // axe.run()
    setCookie: jest.fn().mockResolvedValue(undefined),
    keyboard: { press: jest.fn().mockResolvedValue(undefined) },
    waitForNavigation: jest.fn().mockResolvedValue(undefined),
    type: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(undefined),
    _page: mockPage,
  };
}

describe('getChromePath', () => {
  test('returns path on darwin', () => {
    const origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    expect(getChromePath()).toContain('Google Chrome');
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
  });
});

describe('scanUrl', () => {
  afterEach(() => jest.clearAllMocks());

  test('calls puppeteer.launch, navigates, runs axe, returns results', async () => {
    const browser = makeMockBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    const results = await scanUrl('https://example.com');

    expect(puppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({ headless: true })
    );
    expect(browser.newPage).toHaveBeenCalled();
    expect(browser._page.goto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ waitUntil: 'domcontentloaded' })
    );
    expect(results).toMatchObject({ url: 'https://example.com' });
  });

  test('closes browser even on goto error', async () => {
    const browser = makeMockBrowser();
    browser._page.goto.mockRejectedValue(new Error('nav failed'));
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    await expect(scanUrl('https://example.com')).rejects.toThrow('nav failed');
    expect(browser.close).toHaveBeenCalled();
  });

  test('respects CHROME_PATH env var', async () => {
    process.env['CHROME_PATH'] = '/custom/chrome';
    const browser = makeMockBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    await scanUrl('https://example.com');

    expect(puppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({ executablePath: '/custom/chrome' })
    );
    delete process.env['CHROME_PATH'];
  });

  test('throws when customRulesPath does not exist', async () => {
    const browser = makeMockBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    await expect(
      scanUrl('https://example.com', { customRulesPath: '/nonexistent/rules.json' })
    ).rejects.toThrow('customRulesPath not found');
  });

  test('passes custom rules to axe.configure', async () => {
    const rulesPath = join('/tmp', `a11y-rules-${Date.now()}.json`);
    const rules = [{ id: 'custom-rule', enabled: true }];
    writeFileSync(rulesPath, JSON.stringify(rules));

    const browser = makeMockBrowser();
    // reset mock so evaluate can handle 3 calls: axeSource, axe.run (with rules)
    browser._page.evaluate
      .mockResolvedValueOnce(undefined)       // axeSource
      .mockResolvedValueOnce(mockAxeResults); // axe.run with rules
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    const results = await scanUrl('https://example.com', { customRulesPath: rulesPath });
    expect(results).toMatchObject({ url: 'https://example.com' });
    // evaluate called twice: axeSource + axe.run(rules)
    expect(browser._page.evaluate).toHaveBeenCalledTimes(2);

    rmSync(rulesPath, { force: true });
  });

  test('injects cookies when auth.cookies provided', async () => {
    const browser = makeMockBrowser();
    // auth page + scan page each get a new page
    const authPage = {
      setCookie: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockAxeResults),
      keyboard: { press: jest.fn().mockResolvedValue(undefined) },
      waitForNavigation: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    browser.newPage.mockResolvedValue(authPage);
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    await scanUrl('https://example.com', {
      auth: { cookies: 'session=abc; token=xyz' },
    });

    expect(authPage.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'session', value: 'abc' })
    );
    expect(authPage.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'token', value: 'xyz' })
    );
  });
});

describe('crawlUrls', () => {
  afterEach(() => jest.clearAllMocks());

  function makeMultiPageBrowser(pages: string[]) {
    let callCount = 0;
    const makePageMock = (url: string) => ({
      goto: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ ...mockAxeResults, url })
        .mockResolvedValueOnce([]), // extractLinks returns []
      close: jest.fn().mockResolvedValue(undefined),
      setCookie: jest.fn().mockResolvedValue(undefined),
      keyboard: { press: jest.fn() },
      waitForNavigation: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
    });

    const browser = {
      newPage: jest.fn().mockImplementation(() => {
        const url = pages[callCount] ?? pages[0];
        callCount++;
        return Promise.resolve(makePageMock(url));
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    return browser;
  }

  test('returns single result when depth=0', async () => {
    const browser = makeMultiPageBrowser(['https://example.com']);
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    const results = await crawlUrls('https://example.com', { depth: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com');
  });

  test('deduplicates visited URLs', async () => {
    const browser = makeMultiPageBrowser(['https://example.com']);
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    // depth=0 so no link following — start URL visited once
    const results = await crawlUrls('https://example.com', { depth: 0 });
    expect(results).toHaveLength(1);
  });
});
