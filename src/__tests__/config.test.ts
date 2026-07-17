import { loadConfig, A11yConfig } from '../config';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const tmpDir = '/tmp/a11y-config-test-' + Date.now();

beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

describe('loadConfig', () => {
  test('returns empty object when no config file exists', () => {
    const cfg = loadConfig(tmpDir);
    expect(cfg).toEqual({});
  });

  test('loads .a11yrc.json', () => {
    const config: A11yConfig = { level: 'AAA', format: 'html', save: true };
    writeFileSync(join(tmpDir, '.a11yrc.json'), JSON.stringify(config));
    const cfg = loadConfig(tmpDir);
    expect(cfg.level).toBe('AAA');
    expect(cfg.format).toBe('html');
    expect(cfg.save).toBe(true);
  });

  test('loads .a11yrc.yaml', () => {
    writeFileSync(
      join(tmpDir, '.a11yrc.yaml'),
      'level: AA\nformat: csv\nsave: false\nreportsDir: ./out\n'
    );
    const cfg = loadConfig(tmpDir);
    expect(cfg.level).toBe('AA');
    expect(cfg.format).toBe('csv');
    expect(cfg.save).toBe(false);
    expect(cfg.reportsDir).toBe('./out');
  });

  test('loads .a11yrc.yml', () => {
    writeFileSync(join(tmpDir, '.a11yrc.yml'), 'level: A\nformat: json\n');
    const cfg = loadConfig(tmpDir);
    expect(cfg.level).toBe('A');
    expect(cfg.format).toBe('json');
  });

  test('json takes precedence over yaml when both present', () => {
    writeFileSync(join(tmpDir, '.a11yrc.json'), JSON.stringify({ level: 'AAA' }));
    writeFileSync(join(tmpDir, '.a11yrc.yaml'), 'level: A\n');
    const cfg = loadConfig(tmpDir);
    expect(cfg.level).toBe('AAA');
  });

  // Security: prototype pollution prevention (#25)
  test('blocks __proto__ key in JSON config', () => {
    // Crafted JSON — standard JSON.parse won't actually set __proto__ but
    // our sanitizeConfig must not copy it to cfg
    writeFileSync(join(tmpDir, '.a11yrc.json'), '{"level":"AA","__proto__":{"polluted":true}}');
    const cfg = loadConfig(tmpDir) as any;
    expect(cfg.level).toBe('AA');
    expect(cfg.polluted).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined(); // prototype not polluted
  });

  test('blocks __proto__ key in YAML config', () => {
    writeFileSync(join(tmpDir, '.a11yrc.yaml'), '__proto__: bad\nlevel: AA\n');
    const cfg = loadConfig(tmpDir) as any;
    expect(cfg.level).toBe('AA');
    // __proto__ must not be set as an own property on the returned config
    expect(Object.prototype.hasOwnProperty.call(cfg, '__proto__')).toBe(false);
    // prototype must not be polluted — a fresh object must not have 'polluted'
    expect(Object.prototype.hasOwnProperty.call({}, 'bad')).toBe(false);
  });

  test('rejects unknown format values', () => {
    writeFileSync(join(tmpDir, '.a11yrc.json'), JSON.stringify({ format: 'evil' }));
    const cfg = loadConfig(tmpDir);
    expect(cfg.format).toBeUndefined();
  });

  test('rejects unknown level values', () => {
    writeFileSync(join(tmpDir, '.a11yrc.json'), JSON.stringify({ level: 'EVIL' }));
    const cfg = loadConfig(tmpDir);
    expect(cfg.level).toBeUndefined();
  });

  test('ignores non-object JSON (array)', () => {
    writeFileSync(join(tmpDir, '.a11yrc.json'), '["not","an","object"]');
    const cfg = loadConfig(tmpDir);
    expect(cfg).toEqual({});
  });
});
