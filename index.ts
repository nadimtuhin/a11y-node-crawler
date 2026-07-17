// Public API re-exports
export { scanUrl, crawlUrls, getChromePath } from './src/scanner';
export type { ScanOptions, CrawlResult } from './src/scanner';
export { filterByLevel, parseResults } from './src/filter';
export { toPlainText, toHtml, toCsv, saveReport, sendWebhook } from './src/reporter';
export { loadConfig } from './src/config';
export { openDb, logScan, getHistory } from './src/history';
export { runLighthouse, mockLighthouseResult } from './src/lighthouse';
export type { LighthouseA11yResult, LighthouseAudit } from './src/lighthouse';
export { captureViolationScreenshots, capturePageScreenshot } from './src/screenshots';
export type { ScreenshotResult } from './src/screenshots';
export { startSpinner, printLiveStats, endLiveStats } from './src/progress';
export type { SpinnerHandle, LiveStats } from './src/progress';
export type { WcagLevel } from './src/filter';
export type { ParsedResults } from './src/reporter';
export type { A11yConfig, AuthConfig } from './src/config';
export type { HistoryRow } from './src/history';
