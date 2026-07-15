import puppeteer from 'puppeteer-core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const axeSource = require('axe-core').source;

export async function scanUrl(url: string) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  await page.evaluate(axeSource);
  
  const results = await page.evaluate(() => {
    // @ts-ignore
    return window.axe.run();
  });
  
  await browser.close();
  return results;
}
