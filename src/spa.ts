/**
 * SPA MutationObserver audit: inject observer into page, trigger navigation,
 * re-run axe after DOM settles.
 * Closes #13
 */
import type { AxeResults } from 'axe-core';
import { readFileSync } from 'fs';

export interface SpaAuditResult {
  url: string;
  /** axe results captured after each detected DOM mutation batch */
  snapshots: AxeResults[];
}

/**
 * Navigates to `url`, injects a MutationObserver that fires after DOM goes
 * quiet for `settleMs` ms, then re-runs axe up to `maxSnapshots` times.
 *
 * ponytail: no SPA router hook — relies purely on DOM change detection;
 * add History API interception when framework-specific routing needed.
 */
export async function auditSpa(
  page: import('puppeteer-core').Page,
  url: string,
  options: { settleMs?: number; maxSnapshots?: number } = {}
): Promise<SpaAuditResult> {
  const settleMs = options.settleMs ?? 500;
  const maxSnapshots = options.maxSnapshots ?? 5;

  const axePath = require.resolve('axe-core');
  const axeSource = readFileSync(axePath, 'utf8');

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
  await page.evaluate(axeSource);

  // Inject observer that sets window.__mutated = true on DOM change
  await page.evaluate((ms: number) => {
    (window as any).__mutated = false;
    (window as any).__mutationTimer = null;
    const obs = new MutationObserver(() => {
      clearTimeout((window as any).__mutationTimer);
      (window as any).__mutationTimer = setTimeout(() => {
        (window as any).__mutated = true;
      }, ms);
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    (window as any).__spaObserver = obs;
  }, settleMs);

  const snapshots: AxeResults[] = [];

  // First snapshot — initial page state
  const first = await page.evaluate(() => (window as any).axe.run()) as AxeResults;
  snapshots.push(first);

  // Poll for DOM mutations, re-run axe when settled
  for (let i = 1; i < maxSnapshots; i++) {
    // Wait for mutation flag or timeout
    const mutated = await page.evaluate(
      (waitMs: number) =>
        new Promise<boolean>((resolve) => {
          const check = () => {
            if ((window as any).__mutated) {
              (window as any).__mutated = false;
              resolve(true);
            }
          };
          const interval = setInterval(check, 50);
          setTimeout(() => { clearInterval(interval); resolve(false); }, waitMs);
        }),
      settleMs * 6 // give up waiting after 6× settle window
    );

    if (!mutated) break;

    await page.evaluate(axeSource); // re-inject in case SPA replaced head
    const snap = await page.evaluate(() => (window as any).axe.run()) as AxeResults;
    snapshots.push(snap);
  }

  return { url, snapshots };
}
