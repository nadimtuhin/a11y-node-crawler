// Public API re-exports
export { scanUrl, getChromePath } from './src/scanner';
export { filterByLevel, parseResults } from './src/filter';
export { toPlainText, toHtml, toCsv, saveReport } from './src/reporter';
export { loadConfig } from './src/config';
export type { WcagLevel } from './src/filter';
export type { ParsedResults } from './src/reporter';
export type { A11yConfig } from './src/config';
