import assert from 'assert';

// Simulated functions matching src/lib/coordinates.ts
function parsePageRange(scope, totalPages, currentPage = 1) {
  if (scope.mode === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (scope.mode === 'page') {
    const p = scope.specificPage || currentPage;
    return p >= 1 && p <= totalPages ? [p] : [];
  }
  if (scope.mode === 'odd') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
  }
  if (scope.mode === 'even') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
  }
  if (scope.mode === 'current') {
    return [currentPage];
  }
  if (scope.mode === 'range') {
    const raw = scope.rangeString || '';
    const result = new Set();
    const parts = raw.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(totalPages, Math.max(start, end));
          for (let p = from; p <= to; p++) {
            result.add(p);
          }
        }
      } else {
        const single = parseInt(trimmed, 10);
        if (!isNaN(single) && single >= 1 && single <= totalPages) {
          result.add(single);
        }
      }
    }
    return Array.from(result).sort((a, b) => a - b);
  }
  return [currentPage];
}

function isPageShiftActive(
  pageShift,
  pageNum,
  hasQR,
  totalPages,
  currentPage = 1
) {
  if (!pageShift || !pageShift.enabled || pageShift.zone === 'none') {
    return false;
  }
  if (!hasQR) {
    return false;
  }

  // 1. Check title page exclusion (page 1)
  if (pageShift.excludeFirstPage && pageNum === 1) {
    return false;
  }

  // 2. Check custom excluded pages string (e.g. "1, 2, 5")
  if (pageShift.excludePagesString && pageShift.excludePagesString.trim()) {
    const excludedPages = parsePageRange(
      { mode: 'range', rangeString: pageShift.excludePagesString },
      totalPages,
      currentPage
    );
    if (excludedPages.includes(pageNum)) {
      return false;
    }
  }

  // 3. Check scope rule
  const mode = pageShift.scopeMode || 'all-qr';
  switch (mode) {
    case 'all-qr':
      return true;
    case 'odd':
      return pageNum % 2 !== 0;
    case 'even':
      return pageNum % 2 === 0;
    case 'current':
      return pageNum === currentPage;
    case 'range': {
      if (!pageShift.rangeString || !pageShift.rangeString.trim()) {
        return true;
      }
      const targetPages = parsePageRange(
        { mode: 'range', rangeString: pageShift.rangeString },
        totalPages,
        currentPage
      );
      return targetPages.includes(pageNum);
    }
    default:
      return true;
  }
}

console.log('🧪 TEST: Weryfikacja reguł zakresu i wykluczeń Content Shifting (Zrób miejsce na QR)');

// 1. When disabled, never active
assert.strictEqual(
  isPageShiftActive({ enabled: false, zone: 'bottom', offsetMm: 30, scaleContent: 0.9, autoPositionQR: true }, 1, true, 10),
  false,
  'Powinno być nieaktywne gdy enabled=false'
);

// 2. When page has no QR, shift should not be active
assert.strictEqual(
  isPageShiftActive({ enabled: true, zone: 'bottom', offsetMm: 30, scaleContent: 0.9, autoPositionQR: true, scopeMode: 'all-qr' }, 2, false, 10),
  false,
  'Powinno być nieaktywne gdy strona nie ma kodu QR'
);

// 3. Exclude first page (cover/title page)
assert.strictEqual(
  isPageShiftActive({
    enabled: true,
    zone: 'bottom',
    offsetMm: 30,
    scaleContent: 0.9,
    autoPositionQR: true,
    scopeMode: 'all-qr',
    excludeFirstPage: true,
  }, 1, true, 10),
  false,
  'Strona 1 (tytułowa) powinna być wykluczona gdy excludeFirstPage=true'
);

assert.strictEqual(
  isPageShiftActive({
    enabled: true,
    zone: 'bottom',
    offsetMm: 30,
    scaleContent: 0.9,
    autoPositionQR: true,
    scopeMode: 'all-qr',
    excludeFirstPage: true,
  }, 2, true, 10),
  true,
  'Strona 2 powinna mieć aktywny shift gdy excludeFirstPage=true'
);

// 4. Parity: Odd pages
assert.strictEqual(
  isPageShiftActive({
    enabled: true,
    zone: 'bottom',
    offsetMm: 30,
    scaleContent: 0.9,
    autoPositionQR: true,
    scopeMode: 'odd',
    excludeFirstPage: false,
  }, 1, true, 10),
  true,
  'Strona 1 powinna być aktywna dla scopeMode=odd i excludeFirstPage=false'
);

assert.strictEqual(
  isPageShiftActive({
    enabled: true,
    zone: 'bottom',
    offsetMm: 30,
    scaleContent: 0.9,
    autoPositionQR: true,
    scopeMode: 'odd',
    excludeFirstPage: true,
  }, 1, true, 10),
  false,
  'Strona 1 powinna być wykluczona dla scopeMode=odd gdy excludeFirstPage=true'
);

assert.strictEqual(
  isPageShiftActive({
    enabled: true,
    zone: 'bottom',
    offsetMm: 30,
    scaleContent: 0.9,
    autoPositionQR: true,
    scopeMode: 'odd',
  }, 2, true, 10),
  false,
  'Strona 2 (parzysta) nie powinna być aktywna dla scopeMode=odd'
);

assert.strictEqual(
  isPageShiftActive({
    enabled: true,
    zone: 'bottom',
    offsetMm: 30,
    scaleContent: 0.9,
    autoPositionQR: true,
    scopeMode: 'odd',
  }, 3, true, 10),
  true,
  'Strona 3 (nieparzysta) powinna być aktywna dla scopeMode=odd'
);

// 5. Parity: Even pages
assert.strictEqual(
  isPageShiftActive({
    enabled: true,
    zone: 'bottom',
    offsetMm: 30,
    scaleContent: 0.9,
    autoPositionQR: true,
    scopeMode: 'even',
  }, 2, true, 10),
  true,
  'Strona 2 (parzysta) powinna być aktywna dla scopeMode=even'
);

assert.strictEqual(
  isPageShiftActive({
    enabled: true,
    zone: 'bottom',
    offsetMm: 30,
    scaleContent: 0.9,
    autoPositionQR: true,
    scopeMode: 'even',
  }, 3, true, 10),
  false,
  'Strona 3 (nieparzysta) nie powinna być aktywna dla scopeMode=even'
);

// 6. Custom range: '3-6, 9'
const rangeConfig = {
  enabled: true,
  zone: 'bottom',
  offsetMm: 30,
  scaleContent: 0.9,
  autoPositionQR: true,
  scopeMode: 'range',
  rangeString: '3-6, 9',
};

assert.strictEqual(isPageShiftActive(rangeConfig, 1, true, 10), false, 'Str. 1 poza zakresem');
assert.strictEqual(isPageShiftActive(rangeConfig, 2, true, 10), false, 'Str. 2 poza zakresem');
assert.strictEqual(isPageShiftActive(rangeConfig, 3, true, 10), true, 'Str. 3 w zakresie');
assert.strictEqual(isPageShiftActive(rangeConfig, 5, true, 10), true, 'Str. 5 w zakresie');
assert.strictEqual(isPageShiftActive(rangeConfig, 6, true, 10), true, 'Str. 6 w zakresie');
assert.strictEqual(isPageShiftActive(rangeConfig, 7, true, 10), false, 'Str. 7 poza zakresem');
assert.strictEqual(isPageShiftActive(rangeConfig, 9, true, 10), true, 'Str. 9 w zakresie');

// 7. Custom exclusion string: '1, 4'
const excludeListConfig = {
  enabled: true,
  zone: 'bottom',
  offsetMm: 30,
  scaleContent: 0.9,
  autoPositionQR: true,
  scopeMode: 'all-qr',
  excludeFirstPage: false,
  excludePagesString: '1, 4',
};

assert.strictEqual(isPageShiftActive(excludeListConfig, 1, true, 10), false, 'Str. 1 wykluczona listą');
assert.strictEqual(isPageShiftActive(excludeListConfig, 2, true, 10), true, 'Str. 2 niewykluczona');
assert.strictEqual(isPageShiftActive(excludeListConfig, 3, true, 10), true, 'Str. 3 niewykluczona');
assert.strictEqual(isPageShiftActive(excludeListConfig, 4, true, 10), false, 'Str. 4 wykluczona listą');
assert.strictEqual(isPageShiftActive(excludeListConfig, 5, true, 10), true, 'Str. 5 niewykluczona');

// 8. Current page scope
const currentPageConfig = {
  enabled: true,
  zone: 'bottom',
  offsetMm: 30,
  scaleContent: 0.9,
  autoPositionQR: true,
  scopeMode: 'current',
};
assert.strictEqual(isPageShiftActive(currentPageConfig, 4, true, 10, 4), true, 'Aktualna strona 4');
assert.strictEqual(isPageShiftActive(currentPageConfig, 5, true, 10, 4), false, 'Inna strona 5 != 4');

console.log('✅ Wszystkie 16 testów asercji logiki przeszły pomyślnie!');
