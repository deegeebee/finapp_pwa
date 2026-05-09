// ── localStorage-Keys ──────────────────────────────────────────────────────
const KEY          = 'expenses_v1';
const KEY_EXPORTED = 'exported_months';
const KEY_THEME    = 'theme';
const KEY_BUDGET   = 'budget_monthly';
const KEY_INCOME   = 'income_v1';       // { 'YYYY-MM': amount }
const KEY_FIXED    = 'fixed_costs_v1';  // [{ id, name, amount }]

// ── Version ────────────────────────────────────────────────────────────────
const APP_VERSION = 'built: 2026-05-08T00:00:00Z';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtEur(val) {
  return Number(val).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ── localStorage-Helfer ────────────────────────────────────────────────────

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}
function saveEntries(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

function loadBudget() {
  const v = parseFloat(localStorage.getItem(KEY_BUDGET));
  return Number.isFinite(v) && v > 0 ? v : null;
}
function saveBudget(val) {
  if (val === null) localStorage.removeItem(KEY_BUDGET);
  else localStorage.setItem(KEY_BUDGET, String(val));
}

function loadIncomeMap() {
  try { return JSON.parse(localStorage.getItem(KEY_INCOME) || '{}'); }
  catch { return {}; }
}
function saveIncomeMap(map) {
  localStorage.setItem(KEY_INCOME, JSON.stringify(map));
}
function getIncomeForMonth(monthKey) {
  const map = loadIncomeMap();
  const v = parseFloat(map[monthKey]);
  return Number.isFinite(v) && v > 0 ? v : null;
}
function setIncomeForMonth(monthKey, val) {
  const map = loadIncomeMap();
  if (val === null) delete map[monthKey];
  else map[monthKey] = val;
  saveIncomeMap(map);
}

function loadFixedCosts() {
  try { return JSON.parse(localStorage.getItem(KEY_FIXED) || '[]'); }
  catch { return []; }
}
function saveFixedCosts(arr) {
  localStorage.setItem(KEY_FIXED, JSON.stringify(arr));
}

/**
 * Gibt für einen Monat (YYYY-MM) die gültigen Fixkosten zurück.
 * Pro eindeutigem Namen wird der neueste Eintrag genommen,
 * dessen validFrom ≤ monthKey ist. Einträge ohne validFrom gelten immer.
 */
function getFixedCostsForMonth(monthKey) {
  const all = loadFixedCosts();
  const best = {};
  all.forEach(f => {
    const from = f.validFrom || '0000-00';
    if (from > monthKey) return;
    if (!best[f.name] || from > (best[f.name].validFrom || '0000-00')) {
      best[f.name] = f;
    }
  });
  return Object.values(best);
}

function getFixedTotal(monthKey) {
  const mk = monthKey || toMonthKey(new Date());
  return getFixedCostsForMonth(mk).reduce((s, f) => s + Number(f.amount), 0);
}

// ── Theme ──────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.body.classList.remove('dark', 'light');
  document.body.classList.add(theme);
  document.getElementById('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(KEY_THEME, theme);
}

function initTheme() {
  const saved = localStorage.getItem(KEY_THEME);
  if (saved) {
    applyTheme(saved);
  } else {
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
}

document.getElementById('themeBtn').addEventListener('click', () => {
  applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
});

// ── Tab-Navigation ─────────────────────────────────────────────────────────

const TAB_TITLES = {
  erfassen:      'Erfassen',
  eintraege:     'Einträge',
  analyse:       'Analyse',
  einstellungen: 'Einstellungen',
};

let currentTab = 'erfassen';

function switchTab(name) {
  currentTab = name;
  document.querySelectorAll('.tab-section').forEach(s => {
    s.classList.toggle('hidden', s.id !== `tab-${name}`);
  });
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.getElementById('topbarTitle').textContent = TAB_TITLES[name] || '';

  // Re-render on switch
  if (name === 'erfassen')      renderMonthSummary();
  if (name === 'eintraege')     renderList();
  if (name === 'analyse')       renderAnalyse();
  if (name === 'einstellungen') renderFixedList();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Monatsübersicht (Tab Erfassen) ─────────────────────────────────────────

function renderMonthSummary() {
  const now      = new Date();
  const monthKey = toMonthKey(now);
  const entries  = loadEntries().filter(e => toMonthKey(new Date(e.date)) === monthKey);
  const varSum   = entries.reduce((s, e) => s + Number(e.price), 0);
  const fixSum   = getFixedTotal(monthKey);
  const totalOut = varSum + fixSum;
  const income   = getIncomeForMonth(monthKey);
  const savings  = income !== null ? income - totalOut : null;
  const budget   = loadBudget();

  document.getElementById('sumExpenses').textContent = fmtEur(totalOut);
  document.getElementById('sumFixed').textContent    = fmtEur(fixSum);

  const incEl = document.getElementById('sumIncome');
  incEl.textContent = income !== null ? fmtEur(income) : '— €';

  const savEl = document.getElementById('sumSavings');
  if (savings !== null) {
    savEl.textContent = (savings >= 0 ? '+' : '') + fmtEur(savings);
    savEl.className = 'stat-val ' + (savings >= 0 ? 'green' : 'red');
  } else {
    savEl.textContent = '— €';
    savEl.className = 'stat-val muted';
  }

  // Budget-Balken (bezieht sich nur auf variable Ausgaben)
  const barWrap = document.getElementById('budgetBarWrap');
  if (budget !== null) {
    const pct = Math.min((varSum / budget) * 100, 100);
    const fill = document.getElementById('budgetBarFill');
    fill.style.width = pct.toFixed(1) + '%';
    fill.classList.remove('near', 'over');
    if (varSum > budget)  fill.classList.add('over');
    else if (pct >= 80)   fill.classList.add('near');
    document.getElementById('budgetBarLabel').textContent =
      `Variable Ausgaben: ${fmtEur(varSum)} / ${fmtEur(budget)}`;
    document.getElementById('budgetBarPct').textContent = Math.round(pct) + ' %';
    barWrap.hidden = false;
  } else {
    barWrap.hidden = true;
  }
}

// ── Einträge-Tab ───────────────────────────────────────────────────────────

let listMonthOffset = 0; // 0 = aktueller Monat

function getMonthKeyWithOffset(offset) {
  const now = new Date();
  const d   = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return toMonthKey(d);
}

function renderList() {
  const monthKey = getMonthKeyWithOffset(listMonthOffset);
  document.getElementById('listMonthLabel').textContent = monthLabel(monthKey);

  const entries = loadEntries()
    .filter(e => toMonthKey(new Date(e.date)) === monthKey)
    .slice().reverse();

  const listEl = document.getElementById('list');
  listEl.innerHTML = '';

  if (entries.length === 0) {
    listEl.innerHTML = '<li class="entry-empty">Keine Einträge in diesem Monat.</li>';
    return;
  }
  entries.forEach(e => {
    const li    = document.createElement('li');
    const left  = document.createElement('div');
    const date  = new Date(e.date).toLocaleDateString('de-DE');
    const rem   = e.remarks ? `<div class="entry-remark">${escapeHtml(e.remarks)}</div>` : '';
    left.innerHTML = `<strong>${escapeHtml(e.category)}</strong><div class="small">${date}</div>${rem}`;
    const right = document.createElement('div');
    right.style.fontWeight = '500';
    right.textContent = fmtEur(e.price);
    li.appendChild(left);
    li.appendChild(right);
    listEl.appendChild(li);
  });
}

document.getElementById('prevMonthBtn').addEventListener('click', () => {
  listMonthOffset--;
  renderList();
});
document.getElementById('nextMonthBtn').addEventListener('click', () => {
  if (listMonthOffset < 0) { listMonthOffset++; renderList(); }
});

// ── Analyse-Tab ────────────────────────────────────────────────────────────

let analyseMonthOffset = 0;

function renderAnalyse() {
  const monthKey = getMonthKeyWithOffset(analyseMonthOffset);
  document.getElementById('analyseMonthLabel').textContent = monthLabel(monthKey);

  const entries = loadEntries().filter(e => toMonthKey(new Date(e.date)) === monthKey);
  const varSum  = entries.reduce((s, e) => s + Number(e.price), 0);
  const fixSum  = getFixedTotal(monthKey);
  const total   = varSum + fixSum;
  const income  = getIncomeForMonth(monthKey);
  const savings = income !== null ? income - total : null;

  document.getElementById('aFixed').textContent    = fmtEur(fixSum);
  document.getElementById('aVariable').textContent = fmtEur(varSum);
  document.getElementById('aTotal').textContent    = fmtEur(total);

  const incEl = document.getElementById('aIncome');
  incEl.textContent = income !== null ? fmtEur(income) : '—';
  incEl.className = 'analyse-val' + (income !== null ? ' green' : '');

  const savEl = document.getElementById('aSavings');
  if (savings !== null) {
    savEl.textContent = (savings >= 0 ? '+' : '') + fmtEur(savings);
    savEl.style.color = savings >= 0 ? '#1a7a52' : '#c0392b';
  } else {
    savEl.textContent = '—';
    savEl.style.color = '';
  }

  // Kategorie-Aufschlüsselung
  const cats = {};
  entries.forEach(e => {
    cats[e.category] = (cats[e.category] || 0) + Number(e.price);
  });
  const catEl = document.getElementById('analyseCats');
  catEl.innerHTML = '';
  if (Object.keys(cats).length === 0) return;

  const maxAmt = Math.max(...Object.values(cats));
  Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, amt]) => {
      const row = document.createElement('div');
      row.className = 'analyse-cat-row';
      const pct = maxAmt > 0 ? (amt / maxAmt) * 100 : 0;
      row.innerHTML = `
        <span class="analyse-cat-name">${escapeHtml(name)}</span>
        <div class="analyse-cat-bar-bg">
          <div class="analyse-cat-bar-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <span class="analyse-cat-amt">${fmtEur(amt)}</span>
      `;
      catEl.appendChild(row);
    });
}

document.getElementById('prevMonthAnalyseBtn').addEventListener('click', () => {
  analyseMonthOffset--;
  renderAnalyse();
  updateExportPreview();
});
document.getElementById('nextMonthAnalyseBtn').addEventListener('click', () => {
  if (analyseMonthOffset < 0) { analyseMonthOffset++; renderAnalyse(); updateExportPreview(); }
});

// ── CSV-Export (im Analyse-Tab) ────────────────────────────────────────────

const exportRangeEl    = document.getElementById('exportRange');
const customDatesEl    = document.getElementById('customDates');
const exportFromEl     = document.getElementById('exportFrom');
const exportToEl       = document.getElementById('exportTo');
const exportFilenameEl = document.getElementById('exportFilename');
const exportCountEl    = document.getElementById('exportCount');

function buildCSV(entries, monthKeys) {
  const q = s => {
    const str = String(s);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? '"' + str.replace(/"/g, '""') + '"' : str;
  };
  const lines = ['Datum,Preis,Typ,Kategorie/Position,Anmerkung'];

  // Variable Ausgaben
  entries.forEach(e => {
    lines.push(e.date + ',' + Number(e.price).toFixed(2) + ',variabel,' + q(e.category) + ',' + q(e.remarks || ''));
  });

  // Fixkosten pro Monat – historisch korrekte Werte
  if (monthKeys && monthKeys.length > 0) {
    monthKeys.forEach(mk => {
      getFixedCostsForMonth(mk).forEach(f => {
        const dateStr = mk + '-01';
        lines.push(dateStr + ',' + Number(f.amount).toFixed(2) + ',Fixkosten,' + q(f.name) + ',gueltig ab ' + (f.validFrom || 'immer'));
      });
    });
  }

  return lines.join('\n');
}

function getRangeBounds(range) {
  const now = new Date();
  let from, to;
  if (range === 'thisMonth') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (range === 'lastMonth') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to   = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (range === 'custom') {
    from = exportFromEl.value ? new Date(exportFromEl.value) : null;
    to   = exportToEl.value   ? new Date(exportToEl.value)   : null;
  } else {
    from = null; to = null;
  }
  return { from, to };
}

function updateFilename() {
  const range = exportRangeEl.value;
  const now   = new Date();
  let name;
  if (range === 'thisMonth')  name = `ausgaben-${toMonthKey(now)}`;
  else if (range === 'lastMonth') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    name = `ausgaben-${toMonthKey(lm)}`;
  } else if (range === 'custom') {
    name = `ausgaben-${exportFromEl.value || 'von'}_${exportToEl.value || 'bis'}`;
  } else {
    name = 'ausgaben-gesamt';
  }
  exportFilenameEl.value = name + '.csv';
}

function updateExportPreview() {
  const { from, to } = getRangeBounds(exportRangeEl.value);
  const filtered = loadEntries().filter(e => {
    const d = new Date(e.date);
    if (from && d < from) return false;
    if (to   && d > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)) return false;
    return true;
  });

  // Betroffene Monate ermitteln (für Fixkosten-Export)
  const monthSet = new Set();
  filtered.forEach(e => monthSet.add(toMonthKey(new Date(e.date))));
  // Bei "alle Daten" oder großen Zeiträumen ohne variable Einträge:
  // Fixkosten-Monate aus dem Zeitraum ergänzen
  if (from && to) {
    let cur = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cur <= end) { monthSet.add(toMonthKey(cur)); cur.setMonth(cur.getMonth() + 1); }
  }
  const monthKeys = Array.from(monthSet).sort();

  exportCountEl.textContent = filtered.length + ' variable Einträge + Fixkosten für ' + monthKeys.length + ' Monat(e).';
  return { filtered, monthKeys };
}

exportRangeEl.addEventListener('change', () => {
  customDatesEl.hidden = exportRangeEl.value !== 'custom';
  updateFilename();
  updateExportPreview();
});
exportFromEl.addEventListener('change', () => { updateFilename(); updateExportPreview(); });
exportToEl.addEventListener('change',   () => { updateFilename(); updateExportPreview(); });

document.getElementById('exportConfirmBtn').addEventListener('click', () => {
  const { filtered, monthKeys } = updateExportPreview();
  if (filtered.length === 0 && monthKeys.length === 0) { alert('Keine Einträge im gewählten Zeitraum.'); return; }
  const csv  = buildCSV(filtered, monthKeys);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = exportFilenameEl.value || 'ausgaben.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// ── Einstellungen: Einnahmen ───────────────────────────────────────────────

const incomeInput    = document.getElementById('incomeInput');
const incomeSaveBtn  = document.getElementById('incomeSaveBtn');
const incomeClearBtn = document.getElementById('incomeClearBtn');

function prefillIncomeInput() {
  const monthKey = toMonthKey(new Date());
  const val = getIncomeForMonth(monthKey);
  incomeInput.value = val !== null ? val.toFixed(2) : '';
}

incomeSaveBtn.addEventListener('click', () => {
  const val = parseFloat(incomeInput.value);
  if (!Number.isFinite(val) || val <= 0) {
    alert('Bitte einen gültigen Betrag eingeben (größer als 0).');
    return;
  }
  setIncomeForMonth(toMonthKey(new Date()), val);
  renderMonthSummary();
  alert('Einnahmen gespeichert.');
});

incomeClearBtn.addEventListener('click', () => {
  setIncomeForMonth(toMonthKey(new Date()), null);
  incomeInput.value = '';
  renderMonthSummary();
});

// ── Einstellungen: Budget ──────────────────────────────────────────────────

const budgetInput    = document.getElementById('budgetInput');
const budgetSaveBtn  = document.getElementById('budgetSaveBtn');
const budgetClearBtn = document.getElementById('budgetClearBtn');

function prefillBudgetInput() {
  const budget = loadBudget();
  budgetInput.value = budget !== null ? budget.toFixed(2) : '';
}

budgetSaveBtn.addEventListener('click', () => {
  const val = parseFloat(budgetInput.value);
  if (!Number.isFinite(val) || val <= 0) {
    alert('Bitte ein gültiges Budget eingeben (größer als 0).');
    return;
  }
  saveBudget(val);
  renderMonthSummary();
  alert('Budget gespeichert.');
});

budgetClearBtn.addEventListener('click', () => {
  saveBudget(null);
  budgetInput.value = '';
  renderMonthSummary();
});

// ── Einstellungen: Fixkosten ───────────────────────────────────────────────

function renderFixedList() {
  prefillIncomeInput();
  prefillBudgetInput();

  const costs = loadFixedCosts();
  const ul    = document.getElementById('fixedList');
  ul.innerHTML = '';

  if (costs.length === 0) {
    ul.innerHTML = '<li class="hint-text" style="padding:6px 0">Noch keine Fixkosten eingetragen.</li>';
    return;
  }

  // Nach Name gruppieren, dann innerhalb jeder Gruppe nach validFrom sortieren
  const groups = {};
  costs.forEach(f => {
    if (!groups[f.name]) groups[f.name] = [];
    groups[f.name].push(f);
  });
  Object.values(groups).forEach(g => g.sort((a, b) => (b.validFrom || '').localeCompare(a.validFrom || '')));

  // Aktuelle Gesamtsumme (dieser Monat)
  const currentMonthKey = toMonthKey(new Date());
  const currentTotal    = getFixedTotal(currentMonthKey);

  Object.entries(groups).forEach(([name, versions]) => {
    versions.forEach((f, i) => {
      const li = document.createElement('li');
      const isLatest = i === 0;
      li.style.opacity = isLatest ? '1' : '0.5';
      li.innerHTML =
        '<span class="fixed-name">' + escapeHtml(f.name) +
          (versions.length > 1 ? ' <span class="fixed-version">' + (isLatest ? '(aktuell)' : '(alt)') + '</span>' : '') +
        '</span>' +
        '<span class="fixed-from">ab ' + (f.validFrom || '–') + '</span>' +
        '<span class="fixed-amt">' + fmtEur(f.amount) + '</span>' +
        '<button class="fixed-del" data-id="' + f.id + '" title="Löschen">✕</button>';
      ul.appendChild(li);
    });
  });

  // Summenzeile
  const sumLi = document.createElement('li');
  sumLi.style.fontWeight = '600';
  sumLi.style.borderTop  = '1px solid #ccc';
  sumLi.style.marginTop  = '4px';
  sumLi.innerHTML = '<span class="fixed-name">Gesamt (aktuell)</span><span class="fixed-amt">' + fmtEur(currentTotal) + '</span>';
  ul.appendChild(sumLi);

  ul.querySelectorAll('.fixed-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      saveFixedCosts(loadFixedCosts().filter(f => f.id !== id));
      renderFixedList();
      renderMonthSummary();
    });
  });
}

document.getElementById('fixedAddBtn').addEventListener('click', () => {
  const name      = document.getElementById('fixedName').value.trim();
  const amount    = parseFloat(document.getElementById('fixedAmount').value);
  const validFrom = document.getElementById('fixedValidFrom').value || toMonthKey(new Date());
  if (!name) { alert('Bitte eine Bezeichnung eingeben.'); return; }
  if (!Number.isFinite(amount) || amount <= 0) { alert('Bitte einen gültigen Betrag eingeben.'); return; }

  const costs = loadFixedCosts();
  costs.push({ id: Date.now(), name, amount, validFrom });
  saveFixedCosts(costs);

  document.getElementById('fixedName').value      = '';
  document.getElementById('fixedAmount').value    = '';
  document.getElementById('fixedValidFrom').value = '';
  renderFixedList();
  renderMonthSummary();
});

// ── Kategorie-Buttons ──────────────────────────────────────────────────────

const catEl = document.getElementById('category');

document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    catEl.value = btn.dataset.value;
  });
});

// ── Speichern ──────────────────────────────────────────────────────────────

document.getElementById('saveBtn').addEventListener('click', () => {
  const price    = parseFloat(document.getElementById('price').value);
  const category = catEl.value || 'Basis';
  const remarks  = document.getElementById('remarks').value.trim();

  if (!Number.isFinite(price) || price === 0) {
    alert('Bitte einen gültigen Preis eingeben.');
    return;
  }

  const entries = loadEntries();
  entries.push({
    id: Date.now(),
    date: toDateStr(new Date()),
    price: Number(price),
    category: String(category),
    remarks,
  });
  saveEntries(entries);

  document.getElementById('price').value   = '';
  document.getElementById('remarks').value = '';
  document.querySelectorAll('.cat-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  catEl.value = 'Basis';

  renderMonthSummary();
});

// ── Monatlicher Export-Reminder ────────────────────────────────────────────

function wurdeExportiert(monthKey) {
  return JSON.parse(localStorage.getItem(KEY_EXPORTED) || '[]').includes(monthKey);
}
function markiereAlsExportiert(monthKey) {
  const liste = JSON.parse(localStorage.getItem(KEY_EXPORTED) || '[]');
  if (!liste.includes(monthKey)) { liste.push(monthKey); localStorage.setItem(KEY_EXPORTED, JSON.stringify(liste)); }
}

function exportAndMail(monthKey, entries) {
  const csv      = buildCSV(entries, [monthKey]);
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const filename = `ausgaben-${monthKey}.csv`;
  const a        = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);

  const subject = encodeURIComponent(`Ausgaben ${monthLabel(monthKey)}`);
  const body    = encodeURIComponent(
    `Hallo,\n\nim Anhang findest du die Ausgaben für ${monthLabel(monthKey)}.\n` +
    `Die CSV-Datei "${filename}" liegt in deinem Download-Ordner.\n\nViele Grüße`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  markiereAlsExportiert(monthKey);
  document.getElementById('monthBanner').hidden = true;
}

function pruefeMonatsExport() {
  const heute       = new Date();
  const vormonat    = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
  const vormonatKey = toMonthKey(vormonat);
  const eintraege   = loadEntries().filter(e => toMonthKey(new Date(e.date)) === vormonatKey);
  if (eintraege.length === 0 || wurdeExportiert(vormonatKey)) return;

  const summe = eintraege.reduce((s, e) => s + Number(e.price), 0).toFixed(2);
  document.getElementById('bannerText').textContent =
    `${monthLabel(vormonatKey)}: ${eintraege.length} Einträge, ${summe} € – noch nicht exportiert.`;
  document.getElementById('bannerExportBtn').onclick = () => exportAndMail(vormonatKey, eintraege);
  document.getElementById('bannerSkipBtn').onclick   = () => {
    markiereAlsExportiert(vormonatKey);
    document.getElementById('monthBanner').hidden = true;
  };
  document.getElementById('monthBanner').hidden = false;
}

// ── Löschen (Einstellungen) ────────────────────────────────────────────────

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!confirm('Alle Ausgaben unwiderruflich löschen?')) return;
  localStorage.removeItem(KEY);
  renderMonthSummary();
  renderList();
});

// ── Export-Vorschau initialisieren ─────────────────────────────────────────

function initExport() {
  exportRangeEl.value  = 'thisMonth';
  customDatesEl.hidden = true;
  updateFilename();
  updateExportPreview();
}

// ── Start ──────────────────────────────────────────────────────────────────

renderMonthSummary();
renderList();
initExport();
pruefeMonatsExport();
initTheme();
document.getElementById('versionLabel').textContent = APP_VERSION;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').then(reg => {
    reg.update();
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  }).catch(() => {});
}
