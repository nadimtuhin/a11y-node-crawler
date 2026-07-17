import { runLighthouse, mockLighthouseResult } from '../lighthouse';

// Ensure `require.resolve('lighthouse')` throws so we always hit the mock path
jest.mock('lighthouse', () => { throw new Error('not installed'); }, { virtual: true });

describe('mockLighthouseResult', () => {
  test('returns expected shape', () => {
    const r = mockLighthouseResult('https://example.com');
    expect(r.url).toBe('https://example.com');
    expect(r.runnerName).toBe('mock');
    expect(r.score).toBeNull();
    expect(Array.isArray(r.audits)).toBe(true);
    expect(r.audits.length).toBeGreaterThan(0);
    const audit = r.audits[0];
    expect(audit).toHaveProperty('id');
    expect(audit).toHaveProperty('title');
    expect(audit).toHaveProperty('score');
    expect(audit).toHaveProperty('scoreDisplayMode');
  });
});

describe('runLighthouse (mock path)', () => {
  test('falls back to mock when lighthouse not installed', async () => {
    const result = await runLighthouse('https://example.com');
    expect(result.runnerName).toBe('mock');
    expect(result.url).toBe('https://example.com');
  });

  test('audit IDs are strings', async () => {
    const result = await runLighthouse('https://example.com');
    for (const audit of result.audits) {
      expect(typeof audit.id).toBe('string');
    }
  });
});
