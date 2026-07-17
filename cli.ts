#!/usr/bin/env node
/**
 * a11y-node-crawler CLI
 * Usage: npx ts-node cli.ts <url> [options]
 *   --level      A | AA | AAA        (default: AA)
 *   --format     json | text | html | csv  (default: text)
 *   --save       Save report to ./reports/ directory
 *   --config     Path to config file (default: auto-detect .a11yrc.json/.yaml)
 *   --lighthouse Run Lighthouse accessibility audit (optional)
 *   --screenshot Capture screenshots of violating elements
 *
 * Config file: .a11yrc.json or .a11yrc.yaml in CWD or HOME.
 * CLI flags override config file values.
 */

import { scanUrl } from './src/scanner';
import { parseResults } from './src/filter';
import { toPlainText, toHtml, toCsv, saveReport } from './src/reporter';
import { loadConfig } from './src/config';
import { startSpinner } from './src/progress';
import type { WcagLevel } from './src/filter';

type Format = 'json' | 'text' | 'html' | 'csv';

function parseArgs(argv: string[]): {
  url: string;
  level: WcagLevel;
  format: Format;
  save: boolean;
  reportsDir: string;
  lighthouse: boolean;
  screenshot: boolean;
} {
  const args = argv.slice(2);

  // Load config first; CLI flags override
  const cfg = loadConfig();

  const url = args.find((a) => !a.startsWith('--')) ?? cfg.url;
  if (!url) {
    console.error('Usage: a11y-crawler <url> [--level A|AA|AAA] [--format json|text|html|csv] [--save] [--lighthouse] [--screenshot]');
    process.exit(1);
  }

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const rawLevel = (get('--level') ?? cfg.level ?? 'AA').toUpperCase() as WcagLevel;
  if (!['A', 'AA', 'AAA'].includes(rawLevel)) {
    console.error(`Invalid --level "${rawLevel}". Must be A, AA, or AAA.`);
    process.exit(1);
  }

  const rawFormat = (get('--format') ?? cfg.format ?? 'text').toLowerCase();
  if (!['json', 'text', 'html', 'csv'].includes(rawFormat)) {
    console.error(`Invalid --format "${rawFormat}". Must be json, text, html, or csv.`);
    process.exit(1);
  }

  return {
    url,
    level: rawLevel,
    format: rawFormat as Format,
    save: args.includes('--save') || cfg.save === true,
    reportsDir: cfg.reportsDir ?? './reports',
    lighthouse: args.includes('--lighthouse'),
    screenshot: args.includes('--screenshot'),
  };
}

async function main() {
  const { url, level, format, save, reportsDir, lighthouse, screenshot } = parseArgs(process.argv);

  const spinner = startSpinner(`Scanning ${url} (WCAG ${level})…`);

  try {
    const raw = await scanUrl(url);
    const data = parseResults(raw, level);

    spinner.update(`Scan complete — ${data.violations.length} violation(s)`);

    if (lighthouse) {
      spinner.update('Running Lighthouse audit…');
      const { runLighthouse } = await import('./src/lighthouse');
      const lhResult = await runLighthouse(url);
      const scoreLabel = lhResult.score !== null ? `${Math.round(lhResult.score * 100)}` : 'n/a';
      spinner.update(`Lighthouse a11y score: ${scoreLabel} (runner: ${lhResult.runnerName})`);
      // Print to stderr so it doesn't pollute stdout output
      process.stderr.write(`\nLighthouse a11y score: ${scoreLabel} [${lhResult.runnerName}]\n`);
    }

    if (screenshot) {
      spinner.update('Capturing violation screenshots…');
      const { captureViolationScreenshots } = await import('./src/screenshots');
      const shots = await captureViolationScreenshots(url, raw, `${reportsDir}/screenshots`);
      spinner.update(`Screenshots saved (${shots.length} element(s))`);
    }

    spinner.succeed(`Done — ${data.violations.length} violation(s), ${data.passes} pass(es)`);

    if (save) {
      const fmt = format === 'text' ? 'json' : (format as 'json' | 'html' | 'csv');
      const path = saveReport(data, fmt, reportsDir);
      console.error(`Report saved: ${path}`);
    }

    if (format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else if (format === 'html') {
      console.log(toHtml(data));
    } else if (format === 'csv') {
      console.log(toCsv(data));
    } else {
      console.log(toPlainText(data));
    }
  } catch (err) {
    spinner.fail(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
