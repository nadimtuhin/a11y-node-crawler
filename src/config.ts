/**
 * Config file loader for .a11yrc.json / .a11yrc.yaml / .a11yrc.yml
 * Searches CWD then home directory.
 *
 * Security (#25): prototype pollution prevention — raw parsed objects are
 * validated through an allowlist before being returned as A11yConfig.
 * Keys like __proto__, constructor, and prototype are rejected.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { WcagLevel } from './filter';

export interface AuthConfig {
  /** Cookie string to inject (e.g. "session=abc; token=[REDACTED:API key param]") */
  cookies?: string;
  /** Form-fill login: URL to POST credentials to */
  loginUrl?: string;
  /** Form field name for username/email */
  usernameField?: string;
  /** Form field name for password */
  passwordField?: string;
  /** Username/email value */
  username?: string;
  /** Password value */
  password?: string;
}

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
  /** Deep crawl: follow internal links up to this many levels (default: 0 = single page) */
  depth?: number;
  /** Max pages to crawl (default: 50) */
  maxPages?: number;
  /** Auth config for protected pages */
  auth?: AuthConfig;
  /** Webhook URL for Slack/Discord notifications */
  webhookUrl?: string;
}

const CONFIG_NAMES = ['.a11yrc.json', '.a11yrc.yaml', '.a11yrc.yml'];

/** Keys blocked to prevent prototype pollution */
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Safe string → allowed literal types. Returns undefined for unknown values.
 */
function safeString<T extends string>(val: unknown, allowed?: T[]): T | string | undefined {
  if (typeof val !== 'string') return undefined;
  if (allowed && !allowed.includes(val as T)) return undefined;
  return val as T;
}

/**
 * Build a sanitized A11yConfig from an untrusted parsed object.
 * Only known keys are copied; prototype-polluting keys are rejected.
 */
function sanitizeConfig(raw: Record<string, unknown>): A11yConfig {
  const cfg: A11yConfig = {};

  for (const key of Object.keys(raw)) {
    if (BLOCKED_KEYS.has(key)) continue;
  }

  if (typeof raw['url'] === 'string') cfg.url = raw['url'];
  const lvl = safeString(raw['level'], ['A', 'AA', 'AAA'] as WcagLevel[]);
  if (lvl) cfg.level = lvl as WcagLevel;
  const fmt = safeString(raw['format'], ['json', 'text', 'html', 'csv']);
  if (fmt) cfg.format = fmt as A11yConfig['format'];
  if (typeof raw['save'] === 'boolean') cfg.save = raw['save'];
  if (typeof raw['reportsDir'] === 'string') cfg.reportsDir = raw['reportsDir'];
  if (typeof raw['customRulesPath'] === 'string') cfg.customRulesPath = raw['customRulesPath'];
  if (typeof raw['historyDb'] === 'string') cfg.historyDb = raw['historyDb'];
  if (typeof raw['depth'] === 'number' && Number.isFinite(raw['depth'])) cfg.depth = raw['depth'];
  if (typeof raw['maxPages'] === 'number' && Number.isFinite(raw['maxPages'])) cfg.maxPages = raw['maxPages'];
  if (typeof raw['webhookUrl'] === 'string') cfg.webhookUrl = raw['webhookUrl'];

  if (raw['auth'] && typeof raw['auth'] === 'object' && !Array.isArray(raw['auth'])) {
    const a = raw['auth'] as Record<string, unknown>;
    const auth: AuthConfig = {};
    if (typeof a['cookies'] === 'string') auth.cookies = a['cookies'];
    if (typeof a['loginUrl'] === 'string') auth.loginUrl = a['loginUrl'];
    if (typeof a['usernameField'] === 'string') auth.usernameField = a['usernameField'];
    if (typeof a['passwordField'] === 'string') auth.passwordField = a['passwordField'];
    if (typeof a['username'] === 'string') auth.username = a['username'];
    if (typeof a['password'] === 'string') auth.password = a['password'];
    cfg.auth = auth;
  }

  return cfg;
}

function parseYaml(content: string): Record<string, unknown> {
  // ponytail: minimal YAML parser (key: value pairs only); switch to js-yaml when nested objects needed
  const result: Record<string, unknown> = Object.create(null);
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    if (BLOCKED_KEYS.has(key)) continue; // block prototype-polluting keys
    const val = trimmed.slice(colonIdx + 1).trim();
    if (val === 'true') result[key] = true;
    else if (val === 'false') result[key] = false;
    else if (!isNaN(Number(val)) && val !== '') result[key] = Number(val);
    else result[key] = val.replace(/^['"]|['"]$/g, '');
  }
  return result;
}

export function loadConfig(cwd = process.cwd()): A11yConfig {
  const searchDirs = [cwd, process.env['HOME'] ?? ''];

  for (const dir of searchDirs) {
    for (const name of CONFIG_NAMES) {
      const filepath = join(dir, name);
      if (!existsSync(filepath)) continue;
      const content = readFileSync(filepath, 'utf8');
      let raw: Record<string, unknown>;
      if (name.endsWith('.json')) {
        // Parse into a null-prototype object to avoid __proto__ pollution
        const parsed = JSON.parse(content) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
        raw = parsed as Record<string, unknown>;
      } else {
        raw = parseYaml(content);
      }
      return sanitizeConfig(raw);
    }
  }

  return {};
}
