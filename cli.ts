#!/usr/bin/env node
/**
 * a11y-node-crawler CLI
 * Usage: npx ts-node cli.ts <url> [options]
 *   --level  A | AA | AAA   (default: AA)
 *   --format json | text | html  (default: text)
 *   --save   Save report to ./reports/ directory
 */

import { scanUrl } from './src/scanner';
import { parseResults } from './src/filter';
import { toPlainText, toHtml, saveReport } from './src/reporter';
import type { WcagLevel } from './src/filter';

function parseArgs(argv: string[]): {
  url: string;
  level: WcagLevel;
  format: 'json' | 'text' | 'html';
  save: boolean;
} {
  const args = argv.slice(2);
  const url = args.find((a) => !a.startsWith('--'));
  if (!url) {
    console.error('Usage: a11y-crawler <url> [--level A|AA|AAA] [--format json|text|html] [--save]');
    process.exit(1);
  }

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const rawLevel = (get('--level') ?? 'AA').toUpperCase() as WcagLevel;
  if (!['A', 'AA', 'AAA'].includes(rawLevel)) {
    console.error(`Invalid --level "${rawLevel}". Must be A, AA, or AAA.`);
    process.exit(1);
  }

  const rawFormat = (get('--format') ?? 'text').toLowerCase();
  if (!['json', 'text', 'html'].includes(rawFormat)) {
    console.error(`Invalid --format "${rawFormat}". Must be json, text, or html.`);
    process.exit(1);
  }

  return {
    url,
    level: rawLevel,
    format: rawFormat as 'json' | 'text' | 'html',
    save: args.includes('--save'),
  };
}

async function main() {
  const { url, level, format, save } = parseArgs(process.argv);

  console.error(`Scanning ${url} (WCAG ${level})…`);

  const raw = await scanUrl(url);
  const data = parseResults(raw, level);

  if (save) {
    const fmt = format === 'text' ? 'json' : format as 'json' | 'html';
    const path = saveReport(data, fmt);
    console.error(`Report saved: ${path}`);
  }

  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else if (format === 'html') {
    console.log(toHtml(data));
  } else {
    console.log(toPlainText(data));
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
