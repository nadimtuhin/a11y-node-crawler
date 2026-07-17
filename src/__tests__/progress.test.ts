import { startSpinner, printLiveStats, endLiveStats } from '../progress';

// Capture stderr writes
function captureStderr(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const orig = process.stderr.write.bind(process.stderr);
  // @ts-ignore
  process.stderr.write = (chunk: string) => {
    lines.push(chunk);
    return true;
  };
  return { lines, restore: () => { process.stderr.write = orig; } };
}

describe('startSpinner', () => {
  afterEach(() => jest.useRealTimers());

  test('writes succeed message', () => {
    const cap = captureStderr();
    try {
      const s = startSpinner('loading');
      s.succeed('done');
      expect(cap.lines.join('')).toContain('done');
    } finally {
      cap.restore();
    }
  });

  test('writes fail message', () => {
    const cap = captureStderr();
    try {
      const s = startSpinner('loading');
      s.fail('oops');
      expect(cap.lines.join('')).toContain('oops');
    } finally {
      cap.restore();
    }
  });

  test('update does not throw', () => {
    const cap = captureStderr();
    try {
      const s = startSpinner('loading');
      expect(() => s.update('new message')).not.toThrow();
      s.stop();
    } finally {
      cap.restore();
    }
  });

  test('stop does not throw', () => {
    const cap = captureStderr();
    try {
      const s = startSpinner('loading');
      expect(() => s.stop()).not.toThrow();
    } finally {
      cap.restore();
    }
  });
});

describe('printLiveStats', () => {
  test('outputs stats without throwing', () => {
    const cap = captureStderr();
    try {
      printLiveStats('scan', { scanned: 5, violations: 2, passes: 10 });
      const out = cap.lines.join('');
      expect(out).toContain('scanned: 5');
      expect(out).toContain('violations: 2');
      expect(out).toContain('passes: 10');
    } finally {
      cap.restore();
    }
  });
});

describe('endLiveStats', () => {
  test('does not throw', () => {
    const cap = captureStderr();
    try {
      expect(() => endLiveStats()).not.toThrow();
    } finally {
      cap.restore();
    }
  });
});
