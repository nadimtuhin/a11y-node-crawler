import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve, normalize } from 'path';
import type { Result } from 'axe-core';
import type { WcagLevel } from './filter';

export interface ParsedResults {
  url: string;
  level: WcagLevel;
  violations: Result[];
  passes: number;
  incomplete: number;
  timestamp: string;
}

export function toPlainText(data: ParsedResults): string {
  const lines: string[] = [
    `A11y Scan Report`,
    `URL:       ${data.url}`,
    `WCAG:      ${data.level}`,
    `Timestamp: ${data.timestamp}`,
    ``,
    `Summary`,
    `-------`,
    `  Violations: ${data.violations.length}`,
    `  Passes:     ${data.passes}`,
    `  Incomplete: ${data.incomplete}`,
    ``,
  ];

  if (data.violations.length === 0) {
    lines.push('No violations found at this WCAG level. ✓');
  } else {
    lines.push('Violations');
    data.violations.forEach((v, i) => {
      lines.push(`${i + 1}. [${v.impact?.toUpperCase() ?? 'UNKNOWN'}] ${v.id}`);
      lines.push(`   Description: ${v.description}`);
      lines.push(`   Help: ${v.helpUrl}`);
      lines.push(`   Nodes affected: ${v.nodes.length}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}

export function toHtml(data: ParsedResults): string {
  const violationRows = data.violations.map((v) => `
    <tr>
      <td><code>${v.id}</code></td>
      <td><span class="impact impact-${v.impact}">${v.impact ?? 'unknown'}</span></td>
      <td>${v.description}</td>
      <td>${v.nodes.length}</td>
      <td><a href="${v.helpUrl}" target="_blank">Docs</a></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A11y Report – ${data.url}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    h1 { border-bottom: 2px solid #4a90e2; padding-bottom: .5rem; }
    .meta { background: #f5f5f5; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem; }
    .meta dt { font-weight: 600; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: .25rem; }
    .summary { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; }
    .stat { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: .75rem 1.25rem; text-align: center; }
    .stat .val { font-size: 2rem; font-weight: 700; }
    .stat .lbl { font-size: .8rem; color: #666; }
    .violations { color: #c0392b; }
    .passes { color: #27ae60; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #4a90e2; color: #fff; text-align: left; padding: .5rem .75rem; }
    td { padding: .5rem .75rem; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:hover td { background: #fafafa; }
    .impact { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: .8rem; font-weight: 600; text-transform: capitalize; }
    .impact-critical { background: #fde8e8; color: #c0392b; }
    .impact-serious  { background: #fdebd0; color: #e67e22; }
    .impact-moderate { background: #fef9e7; color: #f39c12; }
    .impact-minor    { background: #eafaf1; color: #27ae60; }
    .no-violations { padding: 2rem; text-align: center; background: #eafaf1; border-radius: 6px; color: #27ae60; font-size: 1.1rem; }
  </style>
</head>
<body>
  <h1>♿ A11y Scan Report</h1>
  <div class="meta">
    <dl>
      <dt>URL</dt><dd>${data.url}</dd>
      <dt>WCAG Level</dt><dd>${data.level}</dd>
      <dt>Scanned at</dt><dd>${data.timestamp}</dd>
    </dl>
  </div>
  <div class="summary">
    <div class="stat"><div class="val violations">${data.violations.length}</div><div class="lbl">Violations</div></div>
    <div class="stat"><div class="val passes">${data.passes}</div><div class="lbl">Passes</div></div>
    <div class="stat"><div class="val">${data.incomplete}</div><div class="lbl">Incomplete</div></div>
  </div>
  ${data.violations.length === 0
    ? '<div class="no-violations">✓ No violations found at WCAG level ' + data.level + '</div>'
    : `<table>
    <thead><tr><th>Rule ID</th><th>Impact</th><th>Description</th><th>Nodes</th><th>Docs</th></tr></thead>
    <tbody>${violationRows}</tbody>
  </table>`}
</body>
</html>`;
}

export function toCsv(data: ParsedResults): string {
  const header = 'id,impact,description,nodes,helpUrl';
  if (data.violations.length === 0) return header + '\n';
  const rows = data.violations.map((v) =>
    [
      v.id,
      v.impact ?? 'unknown',
      `"${v.description.replace(/"/g, '""')}"`,
      v.nodes.length,
      v.helpUrl,
    ].join(',')
  );
  return [header, ...rows].join('\n') + '\n';
}

export function toMarkdown(data: ParsedResults): string {
  const lines: string[] = [
    `# A11y Scan Report`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| URL | ${data.url} |`,
    `| WCAG Level | ${data.level} |`,
    `| Timestamp | ${data.timestamp} |`,
    `| Violations | ${data.violations.length} |`,
    `| Passes | ${data.passes} |`,
    `| Incomplete | ${data.incomplete} |`,
    ``,
  ];

  if (data.violations.length === 0) {
    lines.push('> ✅ No violations found at WCAG level ' + data.level);
  } else {
    lines.push('## Violations', '');
    data.violations.forEach((v, i) => {
      lines.push(
        `### ${i + 1}. \`${v.id}\` — ${v.impact?.toUpperCase() ?? 'UNKNOWN'}`,
        ``,
        v.description,
        ``,
        `- **Nodes affected:** ${v.nodes.length}`,
        `- **Help:** <${v.helpUrl}>`,
        ``,
      );
    });
  }

  return lines.join('\n');
}

export function toXml(data: ParsedResults): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const violationNodes = data.violations.map((v) =>
    [
      `  <violation id="${esc(v.id)}" impact="${esc(v.impact ?? 'unknown')}" nodes="${v.nodes.length}">`,
      `    <description>${esc(v.description)}</description>`,
      `    <helpUrl>${esc(v.helpUrl)}</helpUrl>`,
      `  </violation>`,
    ].join('\n')
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<a11yReport>`,
    `  <url>${esc(data.url)}</url>`,
    `  <wcagLevel>${esc(data.level)}</wcagLevel>`,
    `  <timestamp>${esc(data.timestamp)}</timestamp>`,
    `  <summary violations="${data.violations.length}" passes="${data.passes}" incomplete="${data.incomplete}"/>`,
    `  <violations>`,
    ...violationNodes,
    `  </violations>`,
    `</a11yReport>`,
  ].join('\n') + '\n';
}

export function saveReport(
  data: ParsedResults,
  format: 'json' | 'html' | 'csv' | 'md' | 'xml',
  reportsDir = './reports',
  /** Max report size in bytes (default 10 MB). Throws if content exceeds this. #31 */
  maxBytes = 10 * 1024 * 1024
): string {
  // Sanitize reportsDir — normalize and resolve to prevent path traversal (#26)
  const safeDir = resolve(normalize(reportsDir));
  mkdirSync(safeDir, { recursive: true });
  const slug = data.url.replace(/[^a-z0-9]/gi, '_').slice(0, 60);
  const ts = data.timestamp.replace(/[:.]/g, '-');
  const ext = format === 'md' ? 'md' : format;
  const filename = `${slug}_${data.level}_${ts}.${ext}`;
  const filepath = join(safeDir, filename);
  let content: string;
  if (format === 'html') content = toHtml(data);
  else if (format === 'csv') content = toCsv(data);
  else if (format === 'md') content = toMarkdown(data);
  else if (format === 'xml') content = toXml(data);
  else content = JSON.stringify(data, null, 2);
  // File size guard (#31)
  const byteLen = Buffer.byteLength(content, 'utf8');
  if (byteLen > maxBytes) {
    throw new Error(`Report exceeds max size (${byteLen} > ${maxBytes} bytes): ${filepath}`);
  }
  writeFileSync(filepath, content, 'utf8');
  return filepath;
}

/**
 * Send scan results to a Slack/Discord webhook.
 * Slack and Discord both accept the same `{"text": "..."}` payload.
 *
 * Security (#33): webhook URL is validated to prevent SSRF to internal hosts;
 * credentials/tokens are masked in logged error messages.
 */
export async function sendWebhook(
  webhookUrl: string,
  data: ParsedResults
): Promise<void> {
  // Validate scheme — only https allowed (#33)
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    throw new Error(`Invalid webhook URL: ${webhookUrl}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Webhook URL must use HTTPS (got ${parsed.protocol})`);
  }

  const status = data.violations.length === 0 ? '✅ No violations' : `⚠️ ${data.violations.length} violation(s)`;
  const text = [
    `*A11y Scan Report* — ${data.url}`,
    `WCAG: ${data.level} | ${status} | Passes: ${data.passes} | Incomplete: ${data.incomplete}`,
    `Scanned: ${data.timestamp}`,
  ].join('\n');

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    // Mask URL credentials in error output (#33)
    const safeUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    throw new Error(`Webhook POST failed: ${res.status} ${res.statusText} (${safeUrl})`);
  }
}
