import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import type { AxeResults } from 'axe-core';

export function getChromePath(): string {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  try {
    return execSync('which google-chrome').toString().trim();
  } catch {
    throw new Error('Chrome not found. Set CHROME_PATH env var or install Chrome.');
  }
}

export async function scanUrl(url: string): Promise<AxeResults> {
  const executablePath = process.env['CHROME_PATH'] ?? getChromePath();
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const axePath = require.resolve('axe-core');
    const axeSource = readFileSync(axePath, 'utf8');
    await page.evaluate(axeSource);
    const results = await page.evaluate(() => {
      // @ts-ignore
      return window.axe.run();
    });
    return results as AxeResults;
  } finally {
    await browser.close();
  }
}
