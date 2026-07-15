// Mock puppeteer-core before any imports
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
  },
}));

import puppeteer from 'puppeteer-core';
import { scanUrl, getChromePath } from '../scanner';
import type { AxeResults } from 'axe-core';

const mockAxeResults: Partial<AxeResults> = {
  url: 'https://example.com',
  violations: [],
  passes: [],
  incomplete: [],
  inapplicable: [],
  timestamp: new Date().toISOString(),
};

function makeMockBrowser() {
  const mockPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn()
      .mockResolvedValueOnce(undefined)         // axeSource injection
      .mockResolvedValueOnce(mockAxeResults),   // axe.run()
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
});
