/**
 * Screenshot capture for a11y-violating elements using Puppeteer.
 * Saves element-level screenshots to ./reports/screenshots/<slug>/.
 *
 * Security (#26): screenshotsDir is validated to prevent path traversal.
 * Security (#28): Chrome path from env is validated; no shell interpolation used.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, resolve, normalize } from 'path';
import { execFileSync } from 'child_process';
import type { AxeResults, Result } from 'axe-core';

export interface ScreenshotResult {
  violationId: string;
  nodeIndex: number;
  selector: string;
  path: string;
}

/**
 * Resolve and validate a directory path — rejects traversal outside allowedBase.
 * If allowedBase is omitted the path is just normalized.
 */
export function safeDirPath(dir: string, allowedBase?: string): string {
  const resolved = resolve(normalize(dir));
  if (allowedBase) {
    const base = resolve(allowedBase);
    if (!resolved.startsWith(base + '/') && resolved !== base) {
      throw new Error(`Screenshots dir outside allowed base: ${dir}`);
    }
  }
  return resolved;
}

/**
 * Validate a Chrome executable path.
 * Only allows absolute paths — rejects shell metacharacters.
 * (#28: prevents command injection via CHROME_PATH env var)
 */
export function validateChromePath(p: string): string {
  if (!p.startsWith('/')) throw new Error(`CHROME_PATH must be absolute: ${p}`);
  // Reject shell metacharacters
  if (/[;&|`$<>!]/.test(p)) throw new Error(`CHROME_PATH contains unsafe characters: ${p}`);
  return p;
}

function getChromePath(): string {
  if (process.env['CHROME_PATH']) return validateChromePath(process.env['CHROME_PATH']);
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  try {
    // execFileSync with fixed args — no shell interpolation (#28)
    return execFileSync('/usr/bin/which', ['google-chrome']).toString().trim();
  } catch {
    throw new Error('Chrome not found. Set CHROME_PATH env var or install Chrome.');
  }
}

function urlSlug(url: string): string {
  return url.replace(/[^a-z0-9]/gi, '_').slice(0, 60);
}

/**
 * For each violation node in `axeResults`, navigate to the page,
 * find the element by its CSS target selector, and capture a screenshot.
 *
 * ponytail: no diffing vs baseline yet; add pixelmatch baseline comparison
 * when visual regression tracking is required (store baselines alongside shots).
 */
export async function captureViolationScreenshots(
  url: string,
  axeResults: AxeResults,
  screenshotsDir = './reports/screenshots'
): Promise<ScreenshotResult[]> {
  const violations = axeResults.violations;
  if (violations.length === 0) return [];

  const slug = urlSlug(url);
  // Validate dir — ponytail: pass an allowedBase from caller when screenshotsDir is user-controlled
  const safeDir = safeDirPath(screenshotsDir);
  const outDir = join(safeDir, slug);
  mkdirSync(outDir, { recursive: true });

  const executablePath = getChromePath();
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const results: ScreenshotResult[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    for (const violation of violations) {
      await captureViolation(page, violation, outDir, results);
    }
  } finally {
    await browser.close();
  }

  return results;
}

async function captureViolation(
  page: import('puppeteer-core').Page,
  violation: Result,
  outDir: string,
  results: ScreenshotResult[]
): Promise<void> {
  for (let i = 0; i < violation.nodes.length; i++) {
    const node = violation.nodes[i];
    const rawSel = node.target?.[0];
    // axe-core CrossTreeSelector can be string | ShadowDomSelector; use only plain strings
    const selector = typeof rawSel === 'string' ? rawSel : '';
    if (!selector) continue;

    try {
      const element = await page.$(selector);
      if (!element) continue;

      const filename = `${violation.id}_node${i}.png`;
      const filepath = join(outDir, filename);
      await element.screenshot({ path: filepath as `${string}.png` });

      results.push({
        violationId: violation.id,
        nodeIndex: i,
        selector,
        path: filepath,
      });
    } catch {
      // element may be detached or off-screen; skip silently
    }
  }
}

/**
 * Full-page screenshot fallback — captures entire page when no specific
 * selectors are available.
 */
export async function capturePageScreenshot(
  url: string,
  screenshotsDir = './reports/screenshots'
): Promise<string> {
  const slug = urlSlug(url);
  const safeDir = safeDirPath(screenshotsDir);
  const outDir = join(safeDir, slug);
  mkdirSync(outDir, { recursive: true });

  const executablePath = getChromePath();
  const browser = await puppeteer.launch({ executablePath, headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const filename = `fullpage_${Date.now()}.png`;
    const filepath = join(outDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  } finally {
    await browser.close();
  }
}
