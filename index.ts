// Public API re-exports
export { scanUrl, crawlUrls, getChromePath } from './src/scanner';
export type { ScanOptions, CrawlResult } from './src/scanner';
export { filterByLevel, parseResults } from './src/filter';
export { toPlainText, toHtml, toCsv, toMarkdown, toXml, saveReport, sendWebhook } from './src/reporter';
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
// New features
export { auditSpa } from './src/spa';
export type { SpaAuditResult } from './src/spa';
export { scanUrlsParallel } from './src/worker-pool';
export type { WorkerPoolOptions } from './src/worker-pool';
export {
  checkAriaRoles,
  checkFocusTrap,
  checkTargetSize,
  checkLangAttr,
  checkSkipNav,
  checkColorBlindness,
  checkLabelAssociation,
  checkAnimationRate,
  checkBrokenAria,
  runExtendedChecks,
  colorBlindnessFilters,
} from './src/checks';
export type { CheckerResult, Finding } from './src/checks';
export { savePdfReport } from './src/pdf';
