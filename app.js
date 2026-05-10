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
 * Einträge mit endMonth ≤ monthKey werden als gekündigt ausgeschlossen.
 */
function getFixedCostsForMonth(monthKey) {
  const all = loadFixedCosts();
  const best = {};
  all.forEach(f => {
    const from = f.validFrom || '0000-00';
    if (from > monthKey) return;                        // noch nicht gültig
    if (f.endMonth && f.endMonth <= monthKey) return;   // bereits gekündigt
    if (!best[f.name] || from > (best[f.name].validFrom || '0000-00')) {
      best[f.name] = f;
    }
  });
  return Object.values(best);
}

/**
 * Für den CSV-Export: alle Fixkosten die in monthKey aktiv waren,
 * inklusive später gekündigter Positionen.
 */
function getFixedCostsForMonthExport(monthKey) {
  const all = loadFixedCosts();
  const best = {};
  all.forEach(f => {
    const from = f.validFrom || '0000-00';
    if (from > monthKey) return;                        // noch nicht gültig
    if (f.endMonth && f.endMonth <= monthKey) return;   // in diesem Monat schon weg
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

const CAT_COLORS = { Muss: '#3B6D11', Soll: '#BA7517', Kann: '#993C1D' };

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

  // Category breakdown
  const byCat = { Muss: 0, Soll: 0, Kann: 0 };
  entries.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.price); });

  // ── Variable Ausgaben: Hauptzeile ──
  document.getElementById('sumMonthLabel').textContent = monthLabel(monthKey);
  document.getElementById('sumVarAmount').textContent = fmtEur(varSum);

  // Budget-Status
  const budgetStatusEl = document.getElementById('budgetStatus');
  if (budget !== null) {
    const pct = Math.min((varSum / budget) * 100, 100);
    const color = varSum > budget ? '#A32D2D' : pct >= 80 ? '#BA7517' : '#0F6E56';
    const budgetFmt = Number.isInteger(budget) ? budget + ' €' : fmtEur(budget);
    budgetStatusEl.textContent = Math.round(pct) + ' % von ' + budgetFmt;
    budgetStatusEl.style.color = color;
    budgetStatusEl.hidden = false;
  } else {
    budgetStatusEl.hidden = true;
  }

  // Segmentierter Balken (Muss / Soll / Kann)
  // Rest-Segment ist via CSS flex:1 immer sichtbar wenn Segmente < 100%
  const segBar = document.getElementById('segBar');
  const ref = budget || varSum || 1;
  segBar.innerHTML = Object.entries(byCat).map(([cat, amt]) => {
    if (amt <= 0) return '';
    const w = Math.min((amt / ref) * 100, 100).toFixed(1);
    return '<div class="seg-piece" style="width:' + w + '%;background:' + CAT_COLORS[cat] + '" title="' + cat + ': ' + fmtEur(amt) + '"></div>';
  }).join('');

  // Kategorie-Labels — immer alle drei anzeigen, auch wenn 0 €
  document.getElementById('segLabels').innerHTML = Object.entries(CAT_COLORS)
    .map(([cat, color]) =>
      '<span class="seg-lbl-item"><span class="seg-dot" style="background:' + color + '"></span>' +
      cat + ' ' + fmtEur(byCat[cat] || 0) + '</span>'
    ).join('');

  // ── Sekundäre Kacheln ──
  document.getElementById('sumFixed').textContent = fmtEur(fixSum);

  const incEl = document.getElementById('sumIncome');
  incEl.textContent = income !== null ? fmtEur(income) : '—';

  const savEl = document.getElementById('sumSavings');
  if (savings !== null) {
    const pctSav = income > 0 ? ' (' + Math.round((savings / income) * 100) + ' %)' : '';
    savEl.textContent = (savings >= 0 ? '+' : '') + fmtEur(savings) + pctSav;
    savEl.className = 'stat-val ' + (savings >= 0 ? 'green' : 'red');
  } else {
    savEl.textContent = '—';
    savEl.className = 'stat-val muted';
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
    const li   = document.createElement('li');
    const left = document.createElement('div');
    const date = new Date(e.date).toLocaleDateString('de-DE');
    const rem  = e.remarks ? `<div class="entry-remark">${escapeHtml(e.remarks)}</div>` : '';
    left.innerHTML = `<strong>${escapeHtml(e.category)}</strong><div class="small">${date}</div>${rem}`;

    const right = document.createElement('div');
    right.className = 'entry-right';
    right.innerHTML = `<span class="entry-amount">${fmtEur(e.price)}</span>
      <button class="entry-del" data-id="${e.id}" title="Eintrag löschen">🗑</button>`;

    li.appendChild(left);
    li.appendChild(right);
    listEl.appendChild(li);
  });

  listEl.querySelectorAll('.entry-del').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Eintrag löschen?')) return;
      saveEntries(loadEntries().filter(e => String(e.id) !== btn.dataset.id));
      renderList();
      renderMonthSummary();
    });
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
let donutChartInstance = null;

const DONUT_COLORS = {
  Fixkosten: '#185FA5',
  Muss:      '#3B6D11',
  Soll:      '#BA7517',
  Kann:      '#993C1D',
};

function renderAnalyse() {
  const monthKey = getMonthKeyWithOffset(analyseMonthOffset);
  document.getElementById('analyseMonthLabel').textContent = monthLabel(monthKey);

  const entries  = loadEntries().filter(e => toMonthKey(new Date(e.date)) === monthKey);
  const varSum   = entries.reduce((s, e) => s + Number(e.price), 0);
  const fixSum   = getFixedTotal(monthKey);
  const total    = varSum + fixSum;
  const income   = getIncomeForMonth(monthKey);
  const savings  = income !== null ? income - total : null;

  // Category sums
  const byCat = { Muss: 0, Soll: 0, Kann: 0 };
  entries.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.price); });

  // Donut data: Fixkosten first, then variable cats
  const labels = ['Fixkosten', 'Muss', 'Soll', 'Kann'];
  const data   = [fixSum, byCat.Muss, byCat.Soll, byCat.Kann];
  const colors = labels.map(l => DONUT_COLORS[l]);

  // Centre total
  document.getElementById('donutTotal').textContent = total > 0 ? fmtEur(total) : '0 €';

  // Draw / update chart
  const ctx = document.getElementById('donutChart').getContext('2d');
  if (donutChartInstance) donutChartInstance.destroy();

  donutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4,
      }]
    },
    options: {
      responsive: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmtEur(ctx.raw),
          }
        }
      }
    }
  });

  // Custom legend
  const legendEl = document.getElementById('donutLegend');
  legendEl.innerHTML = labels.map((lbl, i) =>
    '<div class="donut-leg-item">' +
      '<span class="donut-leg-sq" style="background:' + colors[i] + '"></span>' +
      '<span class="donut-leg-name">' + lbl + '</span>' +
      '<span class="donut-leg-amt">' + fmtEur(data[i]) + '</span>' +
    '</div>'
  ).join('');

  // Summary rows
  const incEl = document.getElementById('aIncome');
  incEl.textContent = income !== null ? fmtEur(income) : '—';
  incEl.className = 'analyse-val' + (income !== null ? ' green' : '');

  document.getElementById('aTotal').textContent = fmtEur(total);

  const savEl = document.getElementById('aSavings');
  if (savings !== null) {
    savEl.textContent = (savings >= 0 ? '+' : '') + fmtEur(savings);
    savEl.style.color = savings >= 0 ? '#1a7a52' : '#c0392b';
  } else {
    savEl.textContent = '—';
    savEl.style.color = '';
  }
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
const exportFormatEl   = document.getElementById('exportFormat');
const customDatesEl    = document.getElementById('customDates');
const exportFromEl     = document.getElementById('exportFrom');
const exportToEl       = document.getElementById('exportTo');
const exportFilenameEl = document.getElementById('exportFilename');
const exportCountEl    = document.getElementById('exportCount');

const CATS = ['Muss', 'Soll', 'Kann'];

function q(s) {
  const str = String(s == null ? '' : s);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? '"' + str.replace(/"/g, '""') + '"' : str;
}

// Option 2: flache Tabelle, eine Zeile pro Buchung/Fixkostenposition pro Monat
function buildCSVFlat(entries, monthKeys) {
  const lines = ['Datum,Monat,Typ,Kategorie,Position/Anmerkung,Betrag'];

  entries.forEach(e => {
    lines.push([
      e.date,
      toMonthKey(new Date(e.date)),
      'variabel',
      q(e.category),
      q(e.remarks || ''),
      Number(e.price).toFixed(2)
    ].join(','));
  });

  monthKeys.forEach(mk => {
    getFixedCostsForMonthExport(mk).forEach(f => {
      const cat = f.category || 'Muss';
      const note = 'gueltig ab ' + (f.validFrom || 'immer') + (f.endMonth ? ' bis ' + f.endMonth : '');
      lines.push([
        mk + '-01',
        mk,
        'fix',
        q(cat),
        q(f.name) + ' (' + note + ')',
        Number(f.amount).toFixed(2)
      ].join(','));
    });
  });

  return lines.join('\n');
}

// Option 3: eine Zeile pro Monat, Spalten für jede Kategorie (fix + variabel zusammen)
function buildCSVMonthly(entries, monthKeys) {
  const header = ['Monat', 'Einnahmen', 'Fixkosten_gesamt', ...CATS.map(c => 'Variabel_' + c), ...CATS.map(c => 'Fix_' + c), 'Ausgaben_gesamt', 'Ersparnis'];
  const lines  = [header.join(',')];

  monthKeys.forEach(mk => {
    const income     = getIncomeForMonth(mk) || '';
    const fixItems   = getFixedCostsForMonthExport(mk);
    const fixTotal   = fixItems.reduce((s, f) => s + Number(f.amount), 0);
    const varEntries = entries.filter(e => toMonthKey(new Date(e.date)) === mk);

    const varByCat = {};
    CATS.forEach(c => { varByCat[c] = 0; });
    varEntries.forEach(e => { varByCat[e.category] = (varByCat[e.category] || 0) + Number(e.price); });

    const fixByCat = {};
    CATS.forEach(c => { fixByCat[c] = 0; });
    fixItems.forEach(f => { const c = f.category || 'Muss'; fixByCat[c] = (fixByCat[c] || 0) + Number(f.amount); });

    const varTotal   = CATS.reduce((s, c) => s + varByCat[c], 0);
    const totalOut   = fixTotal + varTotal;
    const savings    = income !== '' ? (income - totalOut).toFixed(2) : '';

    lines.push([
      mk,
      income !== '' ? Number(income).toFixed(2) : '',
      fixTotal.toFixed(2),
      ...CATS.map(c => varByCat[c].toFixed(2)),
      ...CATS.map(c => fixByCat[c].toFixed(2)),
      totalOut.toFixed(2),
      savings
    ].join(','));
  });

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
  const range  = exportRangeEl.value;
  const format = exportFormatEl.value;
  const now    = new Date();
  const suffix = format === 'monthly' ? '-monatlich' : '-detail';
  let name;
  if (range === 'thisMonth')       name = 'ausgaben-' + toMonthKey(now) + suffix;
  else if (range === 'lastMonth') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    name = 'ausgaben-' + toMonthKey(lm) + suffix;
  } else if (range === 'custom')   name = 'ausgaben-' + (exportFromEl.value || 'von') + '_' + (exportToEl.value || 'bis') + suffix;
  else                             name = 'ausgaben-gesamt' + suffix;
  exportFilenameEl.value = name + '.csv';
}

function updateExportPreview() {
  const { from, to } = getRangeBounds(exportRangeEl.value);
  const allEntries = loadEntries();
  const filtered = allEntries.filter(e => {
    const d = new Date(e.date);
    if (from && d < from) return false;
    if (to   && d > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)) return false;
    return true;
  });

  const monthSet = new Set();
  filtered.forEach(e => monthSet.add(toMonthKey(new Date(e.date))));

  if (from && to) {
    let cur = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cur <= end) { monthSet.add(toMonthKey(cur)); cur.setMonth(cur.getMonth() + 1); }
  } else if (exportRangeEl.value === 'all') {
    const allFixed  = loadFixedCosts();
    const allMonths = [
      ...allEntries.map(e => toMonthKey(new Date(e.date))),
      ...allFixed.map(f => f.validFrom || toMonthKey(new Date())),
      toMonthKey(new Date()),
    ].sort();
    if (allMonths.length > 0) {
      const [ey, em] = allMonths[0].split('-').map(Number);
      const [ly, lm] = allMonths[allMonths.length - 1].split('-').map(Number);
      let cur = new Date(ey, em - 1, 1);
      const end = new Date(ly, lm - 1, 1);
      while (cur <= end) { monthSet.add(toMonthKey(cur)); cur.setMonth(cur.getMonth() + 1); }
    }
  }

  const monthKeys = Array.from(monthSet).sort();
  const fmt = exportFormatEl.value === 'monthly' ? 'Monatszusammenfassung' : 'Detailtabelle';
  exportCountEl.textContent = fmt + ': ' + filtered.length + ' variable Einträge, ' + monthKeys.length + ' Monat(e).';
  return { filtered, monthKeys };
}

exportRangeEl.addEventListener('change', () => {
  customDatesEl.hidden = exportRangeEl.value !== 'custom';
  updateFilename();
  updateExportPreview();
});
exportFormatEl.addEventListener('change', () => { updateFilename(); updateExportPreview(); });
exportFromEl.addEventListener('change',   () => { updateFilename(); updateExportPreview(); });
exportToEl.addEventListener('change',     () => { updateFilename(); updateExportPreview(); });

document.getElementById('exportConfirmBtn').addEventListener('click', () => {
  const { filtered, monthKeys } = updateExportPreview();
  if (filtered.length === 0 && monthKeys.length === 0) { alert('Keine Einträge im gewählten Zeitraum.'); return; }
  const csv  = exportFormatEl.value === 'monthly'
    ? buildCSVMonthly(filtered, monthKeys)
    : buildCSVFlat(filtered, monthKeys);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
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

  // Nach Name gruppieren, innerhalb jeder Gruppe nach validFrom absteigend
  const groups = {};
  costs.forEach(f => {
    if (!groups[f.name]) groups[f.name] = [];
    groups[f.name].push(f);
  });
  Object.values(groups).forEach(g =>
    g.sort((a, b) => (b.validFrom || '').localeCompare(a.validFrom || ''))
  );

  const currentMonthKey = toMonthKey(new Date());
  const currentTotal    = getFixedTotal(currentMonthKey);

  Object.entries(groups).forEach(([name, versions]) => {
    versions.forEach((f, i) => {
      const isCancelled = !!(f.endMonth);
      const isLatest    = i === 0;
      const li = document.createElement('li');

      // Visual state
      if (isCancelled) {
        li.style.opacity = '0.45';
      } else if (!isLatest) {
        li.style.opacity = '0.55';
      }

      // Badge text
      let badge = '';
      if (isCancelled) {
        badge = '<span class="fixed-badge cancelled">gekündigt ab ' + f.endMonth + '</span>';
      } else if (versions.filter(v => !v.endMonth).length > 1 && isLatest) {
        badge = '<span class="fixed-badge current">(aktuell)</span>';
      } else if (!isLatest) {
        badge = '<span class="fixed-badge old">(alt)</span>';
      }

      // Buttons: cancelled entries only get hard-delete; active get cancel + hard-delete
      let buttons;
      if (isCancelled) {
        buttons = '<button class="fixed-hardel" data-id="' + f.id + '" title="Eintrag unwiderruflich löschen">🗑</button>';
      } else {
        buttons =
          '<button class="fixed-cancel" data-id="' + f.id + '" title="Kündigen (Verlauf bleibt erhalten)">✕</button>' +
          '<button class="fixed-hardel" data-id="' + f.id + '" title="Eintrag unwiderruflich löschen">🗑</button>';
      }

      li.innerHTML =
        '<span class="fixed-name">' + escapeHtml(f.name) + ' ' + badge + '</span>' +
        '<span class="fixed-cat cat-badge-' + (f.category || 'Muss').toLowerCase() + '">' + (f.category || 'Muss') + '</span>' +
        '<span class="fixed-from">ab ' + (f.validFrom || '–') + '</span>' +
        '<span class="fixed-amt">' + fmtEur(f.amount) + '</span>' +
        '<span class="fixed-actions">' + buttons + '</span>';

      ul.appendChild(li);
    });
  });

  // Summenzeile
  const sumLi = document.createElement('li');
  sumLi.className = 'fixed-total-row';
  sumLi.innerHTML =
    '<span class="fixed-name"><strong>Gesamt (aktuell)</strong></span>' +
    '<span class="fixed-amt"><strong>' + fmtEur(currentTotal) + '</strong></span>';
  ul.appendChild(sumLi);

  // ✕ Kündigen: fragt nach endMonth, setzt es auf dem Eintrag
  ul.querySelectorAll('.fixed-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const id      = Number(btn.dataset.id);
      const rawEnd  = prompt('Ab welchem Monat gekündigt? (Format JJJJ-MM, z.B. 2026-07)\nDer Eintrag bleibt für frühere Monate im Verlauf erhalten.');
      if (!rawEnd) return;
      if (!/^\d{4}-\d{2}$/.test(rawEnd)) { alert('Ungültiges Format. Bitte JJJJ-MM eingeben.'); return; }
      const costs = loadFixedCosts();
      const idx   = costs.findIndex(f => f.id === id);
      if (idx !== -1) { costs[idx].endMonth = rawEnd; saveFixedCosts(costs); }
      renderFixedList();
      renderMonthSummary();
    });
  });

  // 🗑 Wirklich löschen: entfernt den Eintrag komplett aus dem Speicher
  ul.querySelectorAll('.fixed-hardel').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      if (!confirm('Eintrag unwiderruflich löschen?\n\nNur sinnvoll bei Tippfehlern – historische Exporte werden dadurch unvollständig.')) return;
      saveFixedCosts(loadFixedCosts().filter(f => f.id !== id));
      renderFixedList();
      renderMonthSummary();
    });
  });
}

document.getElementById('fixedAddBtn').addEventListener('click', () => {
  const name      = document.getElementById('fixedName').value.trim();
  const amount    = parseFloat(document.getElementById('fixedAmount').value);
  const rawFrom   = document.getElementById('fixedValidFrom').value.trim();
  const category  = document.getElementById('fixedCategory').value || 'Muss';

  if (!name) { alert('Bitte eine Bezeichnung eingeben.'); return; }
  if (!Number.isFinite(amount) || amount <= 0) { alert('Bitte einen gültigen Betrag eingeben.'); return; }

  let validFrom;
  if (!rawFrom) {
    validFrom = toMonthKey(new Date());
  } else if (/^\d{4}-\d{2}$/.test(rawFrom)) {
    validFrom = rawFrom;
  } else {
    alert('„Gültig ab" bitte im Format JJJJ-MM eingeben, z.B. 2026-05.');
    return;
  }

  const costs = loadFixedCosts();
  costs.push({ id: Date.now(), name, amount, validFrom, category });
  saveFixedCosts(costs);

  document.getElementById('fixedName').value      = '';
  document.getElementById('fixedAmount').value    = '';
  document.getElementById('fixedValidFrom').value = '';
  // Reset category buttons to Muss
  document.querySelectorAll('.fixed-cat-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.getElementById('fixedCategory').value = 'Muss';
  renderFixedList();
  renderMonthSummary();
});

// ── Kategorie-Buttons (Ausgaben) ───────────────────────────────────────────

const catEl = document.getElementById('category');

document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    catEl.value = btn.dataset.value;
  });
});

// ── Kategorie-Buttons (Fixkosten) ──────────────────────────────────────────

document.querySelectorAll('.fixed-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fixed-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('fixedCategory').value = btn.dataset.value;
  });
});

// ── Speichern ──────────────────────────────────────────────────────────────

document.getElementById('saveBtn').addEventListener('click', () => {
  const price    = parseFloat(document.getElementById('price').value);
  const category = catEl.value || 'Muss';
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
  catEl.value = 'Muss';

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
  exportFormatEl.value = 'flat';
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
