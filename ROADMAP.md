# Roadmap

Tracks planned features for `a11y-node-crawler`. Items are grouped by milestone. Pull requests and issues welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Milestone 1 — Configurability (v1.1)

### Config File Support
Allow users to define crawl rules, axe-core options, ignored rules, viewport settings, and output format in a single `.a11yrc.json` or `a11yrc.yaml` file, eliminating the need to pass all options programmatically.

**Acceptance criteria:**
- CLI and programmatic API both respect the config file
- Config file fields can be overridden by CLI flags
- Validation with clear error messages on bad config

### Ignore / Allow-list Rules
Let users suppress known false positives via `ignoreRules`, `ignoreSelectors`, or `ignoreUrls` in the config file.

---

## Milestone 2 — CI/CD Integrations (v1.2)

### GitHub Actions Integration
Provide an official `a11y-node-crawler` GitHub Action that runs the crawler on pull requests and posts a summary comment with violation counts and links.

**Acceptance criteria:**
- Action published to GitHub Marketplace
- Configurable fail threshold (e.g. fail if critical violations > 0)
- PR comment with collapsible violation table

### JUnit / SARIF Report Output
Emit test results in JUnit XML and SARIF formats so any CI system (Jenkins, GitLab CI, Azure DevOps) can consume results natively.

**Acceptance criteria:**
- `--reporter junit` writes `a11y-results.xml`
- `--reporter sarif` writes `a11y-results.sarif`
- SARIF output compatible with GitHub Code Scanning

---

## Milestone 3 — Report Export Formats (v1.3)

### HTML Report Export
Generate a self-contained, human-readable HTML report with violation details, screenshots per violation, affected elements highlighted, and WCAG impact labels.

**Acceptance criteria:**
- Single `.html` file, no external dependencies
- Screenshot thumbnails embedded as base64
- Filter/sort violations by impact, rule, URL

### JSON / CSV Export
Structured machine-readable exports for downstream processing or dashboards.

**Acceptance criteria:**
- `--reporter json` writes `a11y-results.json`
- `--reporter csv` writes `a11y-results.csv`
- Both include: url, rule, impact, element, help URL

---

## Milestone 4 — Performance & Scale (v1.4)

### Concurrent Crawling
Crawl multiple pages in parallel with a configurable concurrency limit to speed up large sites.

### Incremental / Diff Mode
Only re-crawl pages that changed since the last run; report a diff of new, resolved, and ongoing violations.

---

## Backlog / Ideas

- Slack / Teams webhook notifications
- Dashboard server with historical trend charts
- Browser extension companion for dev-time checks
- Sitemap-driven crawl (auto-discover URLs from `sitemap.xml`)
- Playwright support alongside Puppeteer
