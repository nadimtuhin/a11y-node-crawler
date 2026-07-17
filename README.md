```
    ___   _____ ____  __  __
   /   | / ___// __ \/ / / /
  / /| | \__ \/ / / / /_/ / 
 / ___ |___/ / /_/ / __  /  
/_/  |_/____/\____/_/ /_/   
  A11y Node Crawler v2.0
```

> Automated accessibility crawler powered by [Puppeteer](https://pptr.dev/) and [axe-core](https://github.com/dequelabs/axe-core). Scan any URL, filter violations by WCAG level (A / AA / AAA), and export reports as plain text, JSON, HTML, or CSV.

---

## Features

- 🔍 **Deep scanning** — injects axe-core into a real Chromium browser via Puppeteer
- 🎯 **WCAG level filtering** — A, AA, or AAA (cumulative)
- 📄 **Multiple output formats** — plain text, JSON, styled HTML
- 💾 **Report persistence** — saves timestamped reports to `./reports/`
- 🧪 **Full test suite** — Jest unit tests covering filter, reporter, and scanner (mocked)

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Google Chrome | any recent version |
| npm | ≥ 8 |

> On macOS, Chrome is expected at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.  
> Override with `CHROME_PATH=/path/to/chrome`.

---

## Installation

```bash
git clone https://github.com/nadimtuhin/a11y-node-crawler.git
cd a11y-node-crawler
npm install
```

### Global install (after build)

```bash
npm run build
npm install -g .
a11y-crawler https://example.com
```

---

## CLI Usage

```
npx ts-node cli.ts <url> [options]
```

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--level` | `A` `AA` `AAA` | `AA` | WCAG conformance level to filter by |
| `--format` | `text` `json` `html` | `text` | Output format |
| `--save` | — | off | Save report to `./reports/` directory |

### Examples

```bash
# Quick text scan at WCAG AA
npx ts-node cli.ts https://example.com

# WCAG A only, output JSON
npx ts-node cli.ts https://example.com --level A --format json

# Full AAA audit, save HTML report
npx ts-node cli.ts https://example.com --level AAA --format html --save

# Pipe JSON report to file
npx ts-node cli.ts https://example.com --format json > report.json

# Custom Chrome path
CHROME_PATH=/opt/google/chrome npx ts-node cli.ts https://example.com
```

### Sample plain-text output

```
A11y Scan Report
================
URL:       https://example.com
WCAG:      AA
Timestamp: 2024-06-01T12:00:00.000Z

Summary
-------
  Violations: 2
  Passes:     38
  Incomplete: 5

Violations
----------
1. [SERIOUS] color-contrast
   Description: Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds
   Help: https://dequeuniversity.com/rules/axe/4.9/color-contrast
   Nodes affected: 4
```

---

## Programmatic API

```typescript
import { scanUrl, parseResults, saveReport, toPlainText, toHtml } from './index';

// Scan
const raw = await scanUrl('https://example.com');

// Filter by WCAG level
const data = parseResults(raw, 'AA');

// Format
console.log(toPlainText(data));

// Save
const path = saveReport(data, 'html');  // → ./reports/https_example_com_AA_....html
console.log(`Saved to ${path}`);
```

---

## Development & Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Build TypeScript
npm run build
```

### Test coverage

| Suite | What's tested |
|-------|--------------|
| `filter.test.ts` | `filterByLevel` tag matching, cumulative levels, edge cases |
| `reporter.test.ts` | `toPlainText`, `toHtml`, `saveReport` (JSON + HTML output) |
| `scanner.test.ts` | `scanUrl` puppeteer flow (mocked), `CHROME_PATH` env, error cleanup |
| `index.test.ts` | Live integration test against `https://example.com` |

---

## Project Structure

```
a11y-node-crawler/
├── src/
│   ├── scanner.ts        # Puppeteer + axe-core browser scanner
│   ├── filter.ts         # WCAG level filtering + result parsing
│   ├── reporter.ts       # Plain text / HTML formatters + file saver
│   └── __tests__/
│       ├── filter.test.ts
│       ├── reporter.test.ts
│       └── scanner.test.ts
├── cli.ts                # CLI entrypoint
├── index.ts              # Public API re-exports
├── index.test.ts         # Integration test
├── reports/              # Generated reports (git-ignored)
├── jest.config.js
├── tsconfig.json
└── package.json
```

---

## WCAG Level Reference

| Level | Includes tags |
|-------|--------------|
| A | `wcag2a`, `wcag21a` |
| AA | all A + `wcag2aa`, `wcag21aa`, `wcag22aa` |
| AAA | all AA + `wcag2aaa` |

---

## License

MIT
