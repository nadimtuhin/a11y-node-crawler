/**
 * Extended accessibility checks beyond axe-core.
 * Covers: ARIA role validation (#16), Focus trap detection (#17),
 * Target size SC 2.5.8 (#18), Lang attr, Skip nav detection (#19),
 * Color blindness simulation (#20), Label association,
 * Animation rate (#21), Broken ARIA (#22).
 */

export interface CheckerResult {
  check: string;
  passed: boolean;
  findings: Finding[];
}

export interface Finding {
  selector?: string;
  message: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | 'info';
}

type RawFinding = { selector?: string; message: string };

function stamp(raw: RawFinding[], impact: Finding['impact']): Finding[] {
  return raw.map((r) => ({ ...r, impact }));
}

function ev<T>(result: unknown): T { return result as unknown as T; }

// ─── ARIA Role Validation (#16) ──────────────────────────────────────────────

const VALID_ARIA_ROLES = [
  'alert','alertdialog','application','article','banner','button','cell',
  'checkbox','columnheader','combobox','complementary','contentinfo',
  'definition','dialog','directory','document','feed','figure','form',
  'grid','gridcell','group','heading','img','link','list','listbox',
  'listitem','log','main','marquee','math','menu','menubar','menuitem',
  'menuitemcheckbox','menuitemradio','navigation','none','note','option',
  'presentation','progressbar','radio','radiogroup','region','row',
  'rowgroup','rowheader','scrollbar','search','searchbox','separator',
  'slider','spinbutton','status','switch','tab','table','tablist','tabpanel',
  'term','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem',
];

export async function checkAriaRoles(page: import('puppeteer-core').Page): Promise<CheckerResult> {
  const raw = ev<RawFinding[]>(await page.evaluate((validRoles: string[]) => {
    const out: { selector: string; message: string }[] = [];
    document.querySelectorAll('[role]').forEach((el) => {
      const role = el.getAttribute('role') ?? '';
      if (!validRoles.includes(role)) {
        out.push({ selector: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`, message: `Invalid ARIA role "${role}"` });
      }
    });
    return out;
  }, VALID_ARIA_ROLES));
  return { check: 'aria-roles', passed: raw.length === 0, findings: stamp(raw, 'serious') };
}

// ─── Focus Trap Detection (#17) ──────────────────────────────────────────────

export async function checkFocusTrap(page: import('puppeteer-core').Page): Promise<CheckerResult> {
  const raw = ev<RawFinding[]>(await page.evaluate(() => {
    const out: { selector: string; message: string }[] = [];
    document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog').forEach((d) => {
      const f = d.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if (f.length === 0) out.push({ selector: `${d.tagName.toLowerCase()}${d.id ? '#'+d.id : ''}`, message: 'Dialog has no focusable elements — focus trap impossible' });
    });
    return out;
  }));
  return { check: 'focus-trap', passed: raw.length === 0, findings: stamp(raw, 'critical') };
}

// ─── Target Size SC 2.5.8 (#18) ──────────────────────────────────────────────

export async function checkTargetSize(page: import('puppeteer-core').Page, minPx = 24): Promise<CheckerResult> {
  const raw = ev<RawFinding[]>(await page.evaluate((min: number) => {
    const out: { selector: string; message: string }[] = [];
    document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="link"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < min || r.height < min) {
        out.push({ selector: `${el.tagName.toLowerCase()}${(el as HTMLElement).id ? '#'+(el as HTMLElement).id : ''}`, message: `Target ${Math.round(r.width)}×${Math.round(r.height)}px < ${min}px (WCAG 2.5.8)` });
      }
    });
    return out;
  }, minPx));
  return { check: 'target-size', passed: raw.length === 0, findings: stamp(raw, 'serious') };
}

// ─── Lang Attribute ───────────────────────────────────────────────────────────

export async function checkLangAttr(page: import('puppeteer-core').Page): Promise<CheckerResult> {
  const raw = ev<RawFinding[]>(await page.evaluate(() => {
    const out: { selector: string; message: string }[] = [];
    const lang = document.documentElement.getAttribute('lang');
    if (!lang || !lang.trim()) out.push({ selector: 'html', message: 'Missing lang attribute on <html>' });
    else if (!/^[a-z]{2,3}(-[A-Z]{2,3})?$/.test(lang.trim())) out.push({ selector: 'html', message: `Invalid lang="${lang}" — use BCP 47 e.g. "en" or "en-US"` });
    return out;
  }));
  return { check: 'lang-attr', passed: raw.length === 0, findings: stamp(raw, 'serious') };
}

// ─── Skip Navigation (#19) ───────────────────────────────────────────────────

export async function checkSkipNav(page: import('puppeteer-core').Page): Promise<CheckerResult> {
  const raw = ev<RawFinding[]>(await page.evaluate(() => {
    const out: { selector: string; message: string }[] = [];
    const skipLinks = Array.from(document.querySelectorAll('a[href^="#"]')).filter((a) => {
      const t = (a.textContent ?? '').toLowerCase();
      return t.includes('skip') || t.includes('jump') || t.includes('main content');
    });
    if (skipLinks.length === 0) return [{ selector: 'body', message: 'No skip navigation link found' }];
    skipLinks.forEach((l) => {
      const href = l.getAttribute('href') ?? '';
      if (!document.querySelector(href)) out.push({ selector: 'a', message: `Skip link "${href}" target not found` });
    });
    return out;
  }));
  return { check: 'skip-nav', passed: raw.length === 0, findings: stamp(raw, 'moderate') };
}

// ─── Color Blindness Simulation (#20) ────────────────────────────────────────

export function colorBlindnessFilters(): Array<{ type: string; css: string }> {
  return [
    { type: 'protanopia',    css: 'url(#protanopia-filter)' },
    { type: 'deuteranopia',  css: 'url(#deuteranopia-filter)' },
    { type: 'tritanopia',    css: 'url(#tritanopia-filter)' },
    { type: 'achromatopsia', css: 'grayscale(100%)' },
  ];
}

export async function checkColorBlindness(page: import('puppeteer-core').Page): Promise<CheckerResult> {
  await page.evaluate(() => {
    if (document.getElementById('__a11y_cb_filters')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = '__a11y_cb_filters';
    svg.setAttribute('style', 'position:absolute;width:0;height:0');
    svg.innerHTML = `<defs>
      <filter id="protanopia-filter"><feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0"/></filter>
      <filter id="deuteranopia-filter"><feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0"/></filter>
      <filter id="tritanopia-filter"><feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0"/></filter>
    </defs>`;
    document.body.prepend(svg);
  });
  return { check: 'color-blindness', passed: true, findings: [{ message: 'Color blindness SVG filters injected (protanopia, deuteranopia, tritanopia, achromatopsia)', impact: 'info' }] };
}

// ─── Label Association ────────────────────────────────────────────────────────

export async function checkLabelAssociation(page: import('puppeteer-core').Page): Promise<CheckerResult> {
  const raw = ev<RawFinding[]>(await page.evaluate(() => {
    const out: { selector: string; message: string }[] = [];
    document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]),select,textarea').forEach((input) => {
      const el = input as HTMLInputElement;
      const id = el.id;
      if (!id || !document.querySelector(`label[for="${id}"]`)) {
        if (!el.closest('label') && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title')) {
          out.push({ selector: `${el.tagName.toLowerCase()}${id ? '#'+id : ''}`, message: 'Form control has no associated label' });
        }
      }
    });
    return out;
  }));
  return { check: 'label-association', passed: raw.length === 0, findings: stamp(raw, 'critical') };
}

// ─── Animation Rate (#21) ────────────────────────────────────────────────────

export async function checkAnimationRate(page: import('puppeteer-core').Page): Promise<CheckerResult> {
  const raw = ev<RawFinding[]>(await page.evaluate(() => {
    const out: { selector: string; message: string }[] = [];
    document.querySelectorAll('*').forEach((el) => {
      const s = window.getComputedStyle(el);
      const dur = parseFloat(s.animationDuration || '0');
      if (s.animationIterationCount === 'infinite' && dur > 0 && dur < 0.333) {
        out.push({ selector: `${el.tagName.toLowerCase()}${(el as HTMLElement).id ? '#'+(el as HTMLElement).id : ''}`, message: `Animation ${(dur*1000).toFixed(0)}ms may exceed 3 flashes/sec (WCAG 2.3.1)` });
      }
    });
    let hasReducedMotion = false;
    try { Array.from(document.styleSheets).forEach((sh) => { Array.from((sh as CSSStyleSheet).cssRules ?? []).forEach((r) => { if (r.cssText.includes('prefers-reduced-motion')) hasReducedMotion = true; }); }); } catch { /* cross-origin */ }
    if (!hasReducedMotion) out.push({ selector: 'html', message: 'No prefers-reduced-motion media query found (WCAG 2.3.3)' });
    return out;
  }));
  return { check: 'animation-rate', passed: raw.length === 0, findings: stamp(raw, 'serious') };
}

// ─── Broken ARIA References (#22) ────────────────────────────────────────────

export async function checkBrokenAria(page: import('puppeteer-core').Page): Promise<CheckerResult> {
  const raw = ev<RawFinding[]>(await page.evaluate(() => {
    const out: { selector: string; message: string }[] = [];
    ['aria-labelledby','aria-describedby','aria-controls','aria-owns','aria-activedescendant','aria-flowto','aria-details'].forEach((attr) => {
      document.querySelectorAll(`[${attr}]`).forEach((el) => {
        (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean).forEach((id) => {
          if (!document.getElementById(id)) {
            out.push({ selector: `${el.tagName.toLowerCase()}${(el as HTMLElement).id ? '#'+(el as HTMLElement).id : ''}`, message: `${attr}="${id}" references non-existent element` });
          }
        });
      });
    });
    return out;
  }));
  return { check: 'broken-aria', passed: raw.length === 0, findings: stamp(raw, 'serious') };
}

// ─── Run all checks ───────────────────────────────────────────────────────────

export async function runExtendedChecks(page: import('puppeteer-core').Page): Promise<CheckerResult[]> {
  return Promise.all([
    checkAriaRoles(page),
    checkFocusTrap(page),
    checkTargetSize(page),
    checkLangAttr(page),
    checkSkipNav(page),
    checkColorBlindness(page),
    checkLabelAssociation(page),
    checkAnimationRate(page),
    checkBrokenAria(page),
  ]);
}
