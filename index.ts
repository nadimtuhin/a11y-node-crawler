// Public API re-exports
export { scanUrl, getChromePath } from './src/scanner';
export type { ScanOptions } from './src/scanner';
export { filterByLevel, parseResults } from './src/filter';
export { toPlainText, toHtml, toCsv, saveReport } from './src/reporter';
export { loadConfig } from './src/config';
export { openDb, logScan, getHistory } from './src/history';
export type { WcagLevel } from './src/filter';
export type { ParsedResults } from './src/reporter';
export type { A11yConfig } from './src/config';
export type { HistoryRow } from './src/history';
