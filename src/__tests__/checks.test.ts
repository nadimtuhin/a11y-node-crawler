/**
 * Tests for extended a11y checks (#16-#22)
 */
import {
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
} from '../checks';

/** Build a mock page whose evaluate() returns a predefined value */
function mockPage(returnValue: unknown) {
  return {
    evaluate: jest.fn().mockResolvedValue(returnValue),
  } as unknown as import('puppeteer-core').Page;
}

describe('checkAriaRoles', () => {
  test('passes when no findings', async () => {
    const page = mockPage([]);
    const r = await checkAriaRoles(page);
    expect(r.check).toBe('aria-roles');
    expect(r.passed).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  test('fails and stamps impact when findings returned', async () => {
    const page = mockPage([{ selector: 'div#foo', message: 'Invalid ARIA role "foo"' }]);
    const r = await checkAriaRoles(page);
    expect(r.passed).toBe(false);
    expect(r.findings[0].impact).toBe('serious');
    expect(r.findings[0].selector).toBe('div#foo');
  });
});

describe('checkFocusTrap', () => {
  test('passes when no findings', async () => {
    const page = mockPage([]);
    const r = await checkFocusTrap(page);
    expect(r.passed).toBe(true);
  });

  test('critical impact on findings', async () => {
    const page = mockPage([{ selector: 'dialog', message: 'no focusable' }]);
    const r = await checkFocusTrap(page);
    expect(r.passed).toBe(false);
    expect(r.findings[0].impact).toBe('critical');
  });
});

describe('checkTargetSize', () => {
  test('passes when no small targets', async () => {
    const r = await checkTargetSize(mockPage([]));
    expect(r.passed).toBe(true);
  });

  test('fails with serious impact', async () => {
    const page = mockPage([{ selector: 'button', message: 'Target 10×10px < 24px' }]);
    const r = await checkTargetSize(page);
    expect(r.passed).toBe(false);
    expect(r.findings[0].impact).toBe('serious');
  });
});

describe('checkLangAttr', () => {
  test('passes when no findings', async () => {
    const r = await checkLangAttr(mockPage([]));
    expect(r.passed).toBe(true);
  });

  test('fails on missing lang', async () => {
    const page = mockPage([{ selector: 'html', message: 'Missing lang attribute on <html>' }]);
    const r = await checkLangAttr(page);
    expect(r.passed).toBe(false);
    expect(r.findings[0].message).toContain('lang');
  });
});

describe('checkSkipNav', () => {
  test('passes when no findings', async () => {
    const r = await checkSkipNav(mockPage([]));
    expect(r.passed).toBe(true);
  });

  test('moderate impact when skip nav missing', async () => {
    const page = mockPage([{ selector: 'body', message: 'No skip navigation link found' }]);
    const r = await checkSkipNav(page);
    expect(r.passed).toBe(false);
    expect(r.findings[0].impact).toBe('moderate');
  });
});

describe('checkColorBlindness', () => {
  test('always passes (simulation only)', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('puppeteer-core').Page;
    const r = await checkColorBlindness(page);
    expect(r.passed).toBe(true);
    expect(r.check).toBe('color-blindness');
    expect(r.findings[0].impact).toBe('info');
  });
});

describe('colorBlindnessFilters', () => {
  test('returns 4 filter types', () => {
    const filters = colorBlindnessFilters();
    expect(filters).toHaveLength(4);
    expect(filters.map((f) => f.type)).toContain('protanopia');
    expect(filters.map((f) => f.type)).toContain('achromatopsia');
  });
});

describe('checkLabelAssociation', () => {
  test('passes when no unlabelled inputs', async () => {
    const r = await checkLabelAssociation(mockPage([]));
    expect(r.passed).toBe(true);
  });

  test('critical impact for unlabelled inputs', async () => {
    const page = mockPage([{ selector: 'input', message: 'Form control has no associated label' }]);
    const r = await checkLabelAssociation(page);
    expect(r.passed).toBe(false);
    expect(r.findings[0].impact).toBe('critical');
  });
});

describe('checkAnimationRate', () => {
  test('passes when no findings', async () => {
    const r = await checkAnimationRate(mockPage([]));
    expect(r.passed).toBe(true);
  });

  test('serious impact on fast animation', async () => {
    const page = mockPage([{ selector: 'div', message: 'Animation 200ms may exceed 3 flashes/sec' }]);
    const r = await checkAnimationRate(page);
    expect(r.passed).toBe(false);
    expect(r.findings[0].impact).toBe('serious');
  });
});

describe('checkBrokenAria', () => {
  test('passes when no broken refs', async () => {
    const r = await checkBrokenAria(mockPage([]));
    expect(r.passed).toBe(true);
  });

  test('serious impact on broken ref', async () => {
    const page = mockPage([{ selector: 'button', message: 'aria-labelledby="missing-id" references non-existent element' }]);
    const r = await checkBrokenAria(page);
    expect(r.passed).toBe(false);
    expect(r.findings[0].impact).toBe('serious');
  });
});

describe('runExtendedChecks', () => {
  test('returns 9 checker results', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue([]) } as unknown as import('puppeteer-core').Page;
    const results = await runExtendedChecks(page);
    expect(results).toHaveLength(9);
    const checks = results.map((r) => r.check);
    expect(checks).toContain('aria-roles');
    expect(checks).toContain('broken-aria');
    expect(checks).toContain('color-blindness');
  });
});
