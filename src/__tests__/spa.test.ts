/**
 * Tests for SPA MutationObserver audit (#13)
 */
import { auditSpa } from '../spa';

function makeMockPage(options: {
  mutates?: boolean;
  axeResults?: object;
} = {}) {
  const axeResults = options.axeResults ?? { violations: [], passes: [], incomplete: [], url: 'https://example.com', timestamp: '' };
  let evaluateCall = 0;

  const page = {
    goto: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn().mockImplementation((fn: unknown, ...args: unknown[]) => {
      evaluateCall++;
      // Call 1: inject axe source (string fn)
      if (typeof fn === 'string') return Promise.resolve(undefined);
      // Call 2+: evaluate callbacks
      const str = fn.toString();
      if (str.includes('__mutated = false')) return Promise.resolve(undefined); // observer setup
      if (str.includes('axe.run')) return Promise.resolve(axeResults);
      if (str.includes('__mutated')) {
        // mutation poll: resolve false (no more mutations)
        return Promise.resolve(options.mutates && evaluateCall < 6 ? true : false);
      }
      return Promise.resolve(undefined);
    }),
  };
  return page;
}

describe('auditSpa', () => {
  test('returns initial snapshot without mutations', async () => {
    const page = makeMockPage();
    const result = await auditSpa(page as any, 'https://example.com', { maxSnapshots: 3 });
    expect(result.url).toBe('https://example.com');
    expect(result.snapshots.length).toBeGreaterThanOrEqual(1);
  });

  test('url matches input', async () => {
    const page = makeMockPage();
    const result = await auditSpa(page as any, 'https://test.example.org');
    expect(result.url).toBe('https://test.example.org');
  });

  test('respects maxSnapshots=1', async () => {
    const page = makeMockPage({ mutates: false });
    const result = await auditSpa(page as any, 'https://example.com', { maxSnapshots: 1 });
    expect(result.snapshots.length).toBe(1);
  });

  test('page.goto called with networkidle2', async () => {
    const page = makeMockPage();
    await auditSpa(page as any, 'https://example.com');
    expect(page.goto).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ waitUntil: 'networkidle2' }));
  });
});
