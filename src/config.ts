/**
 * Config file loader for .a11yrc.json / .a11yrc.yaml / .a11yrc.yml
 * Searches CWD then home directory.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { WcagLevel } from './filter';

export interface A11yConfig {
  url?: string;
  level?: WcagLevel;
  format?: 'json' | 'text' | 'html' | 'csv';
  save?: boolean;
  reportsDir?: string;
  /** Path to a JSON file containing custom axe-core rules array */
  customRulesPath?: string;
  /** Path to SQLite DB for scan history (default: ./history.db) */
  historyDb?: string;
}

const CONFIG_NAMES = ['.a11yrc.json', '.a11yrc.yaml', '.a11yrc.yml'];

function parseYaml(content: string): Record<string, unknown> {
  // ponytail: minimal YAML parser (key: value pairs only); switch to js-yaml when nested objects needed
  const result: Record<string, unknown> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();
    if (val === 'true') result[key] = true;
    else if (val === 'false') result[key] = false;
    else if (!isNaN(Number(val)) && val !== '') result[key] = Number(val);
    else result[key] = val.replace(/^['"]|['"]$/g, '');
  }
  return result;
}

export function loadConfig(cwd = process.cwd()): A11yConfig {
  const searchDirs = [cwd, process.env.HOME ?? ''];

  for (const dir of searchDirs) {
    for (const name of CONFIG_NAMES) {
      const filepath = join(dir, name);
      if (!existsSync(filepath)) continue;
      const content = readFileSync(filepath, 'utf8');
      const raw = name.endsWith('.json')
        ? (JSON.parse(content) as Record<string, unknown>)
        : parseYaml(content);
      return raw as A11yConfig;
    }
  }

  return {};
}
