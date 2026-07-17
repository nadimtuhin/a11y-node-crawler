/**
 * PDF accessibility report export via Puppeteer headless print.
 * Closes #23
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { ParsedResults } from './reporter';
import { toHtml } from './reporter';

function getChromePath(): string {
  if (process.env['CHROME_PATH']) return process.env['CHROME_PATH'];
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  try {
    return execSync('which google-chrome').toString().trim();
  } catch {
    throw new Error('Chrome not found. Set CHROME_PATH env var or install Chrome.');
  }
}

/**
 * Render the HTML report as a PDF via Puppeteer's page.pdf().
 * Returns the output filepath.
 *
 * ponytail: no custom page headers/footers yet; add via page.pdf({ headerTemplate })
 * when branded PDF output is required.
 */
export async function savePdfReport(
  data: ParsedResults,
  reportsDir = './reports'
): Promise<string> {
  mkdirSync(reportsDir, { recursive: true });

  const slug = data.url.replace(/[^a-z0-9]/gi, '_').slice(0, 60);
  const ts = data.timestamp.replace(/[:.]/g, '-');
  const filename = `${slug}_${data.level}_${ts}.pdf`;
  const filepath = join(reportsDir, filename);

  const html = toHtml(data);

  const executablePath = getChromePath();
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
    writeFileSync(filepath, pdfBuffer);
  } finally {
    await browser.close();
  }

  return filepath;
}
