// Public API re-exports
export { scanUrl, crawlUrls, getChromePath } from './src/scanner';
export type { ScanOptions, CrawlResult } from './src/scanner';
export { filterByLevel, parseResults } from './src/filter';
export { toPlainText, toHtml, toCsv, saveReport, sendWebhook } from './src/reporter';
export { loadConfig } from './src/config';
export { openDb, logScan, getHistory } from './src/history';
export type { WcagLevel } from './src/filter';
export type { ParsedResults } from './src/reporter';
export type { A11yConfig, AuthConfig } from './src/config';
export type { HistoryRow } from './src/history';
