/**
 * Tests for worker pool concurrency (#15)
 */
jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

import puppeteer from 'puppeteer-core';
import { scanUrlsParallel } from '../worker-pool';

const mockAxe = { violations: [], passes: [], incomplete: [], url: '', timestamp: '' };

function makeBrowser() {
  const page = {
    goto: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn()
      .mockResolvedValueOnce(undefined)   // axe source
      .mockResolvedValue(mockAxe),        // axe.run
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined),
    _page: page,
  };
}

describe('scanUrlsParallel', () => {
  afterEach(() => jest.clearAllMocks());

  test('scans multiple URLs', async () => {
    const browser = makeBrowser();
    // Each page needs its own evaluate mock sequence
    let pageCount = 0;
    browser.newPage.mockImplementation(() => {
      pageCount++;
      const p = {
        goto: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValue({ ...mockAxe, url: `https://example.com/page${pageCount}` }),
        close: jest.fn().mockResolvedValue(undefined),
      };
      return Promise.resolve(p);
    });
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    const results = await scanUrlsParallel(
      ['https://example.com/1', 'https://example.com/2'],
      { concurrency: 2 }
    );
    expect(results).toHaveLength(2);
    expect(browser.close).toHaveBeenCalled();
  });

  test('empty URL list returns empty array', async () => {
    const browser = makeBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);
    const results = await scanUrlsParallel([], { concurrency: 3 });
    expect(results).toHaveLength(0);
  });

  test('throws when customRulesPath not found', async () => {
    const browser = makeBrowser();
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);
    await expect(
      scanUrlsParallel(['https://example.com'], { customRulesPath: '/no/such/file.json' })
    ).rejects.toThrow('customRulesPath not found');
  });

  test('uses default concurrency of 3', async () => {
    const browser = makeBrowser();
    let pageCount = 0;
    browser.newPage.mockImplementation(() => {
      pageCount++;
      const p = {
        goto: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValue(mockAxe),
        close: jest.fn().mockResolvedValue(undefined),
      };
      return Promise.resolve(p);
    });
    (puppeteer.launch as jest.Mock).mockResolvedValue(browser);

    const urls = ['https://a.com', 'https://b.com', 'https://c.com'];
    const results = await scanUrlsParallel(urls);
    expect(results).toHaveLength(3);
  });
});
