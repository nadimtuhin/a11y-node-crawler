// Public API re-exports
export { scanUrl, getChromePath } from './src/scanner';
export { filterByLevel, parseResults } from './src/filter';
export { toPlainText, toHtml, saveReport } from './src/reporter';
export type { WcagLevel } from './src/filter';
export type { ParsedResults } from './src/reporter';
