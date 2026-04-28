// Persistenz: localStorage
const KEY          = 'expenses_v1';
const KEY_EXPORTED = 'exported_months';
const KEY_THEME    = 'theme';
const KEY_BUDGET   = 'budget_monthly';

// ── Version (bitte bei jedem Deploy auf main aktualisieren) ────────────────
const APP_VERSION = 'built: 2026-04-28T09:23:00Z';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD string using LOCAL time (avoids UTC off-by-one on mobile) */
function toDateStr(date) {
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Gibt "YYYY-MM" für ein Date-Objekt zurück, z.B. "2025-03" */
function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Lesbarer Monatsname, z.B. "März 2025" */
function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

/** Escapes a string for safe insertion into innerHTML */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  if (val === null) {
    localStorage.removeItem(KEY_BUDGET);
  } else {
    localStorage.setItem(KEY_BUDGET, String(val));
  }
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
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

document.getElementById('themeBtn').addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
});

// ── DOM-Referenzen ─────────────────────────────────────────────────────────

const priceEl   = document.getElementById('price');
const catEl     = document.getElementById('category');
const remarksEl = document.getElementById('remarks');
const saveBtn   = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn  = document.getElementById('clearBtn');
const listEl    = document.getElementById('list');
const bannerEl  = document.getElementById('monthBanner');

// ── Burger-Menü / Einstellungen ────────────────────────────────────────────

const burgerBtn      = document.getElementById('burgerBtn');
const settingsPanel  = document.getElementById('settingsPanel');
const budgetInput    = document.getElementById('budgetInput');
const budgetSaveBtn  = document.getElementById('budgetSaveBtn');
const budgetClearBtn = document.getElementById('budgetClearBtn');

burgerBtn.addEventListener('click', () => {
  const isHidden = settingsPanel.hidden;
  settingsPanel.hidden = !isHidden;
  if (!isHidden) return; // closing — nothing more to do
  // Opening: pre-fill with stored budget
  const budget = loadBudget();
  budgetInput.value = budget !== null ? budget.toFixed(2) : '';
});

budgetSaveBtn.addEventListener('click', () => {
  const val = parseFloat(budgetInput.value);
  if (!Number.isFinite(val) || val <= 0) {
    alert('Bitte ein gültiges Budget eingeben (größer als 0).');
    return;
  }
  saveBudget(val);
  settingsPanel.hidden = true;
  renderMonthSummary();
});

budgetClearBtn.addEventListener('click', () => {
  saveBudget(null);
  budgetInput.value = '';
  settingsPanel.hidden = true;
  renderMonthSummary();
});

// ── Monatsübersicht & Budget-Balken ────────────────────────────────────────

function renderMonthSummary() {
  const now      = new Date();
  const monthKey = toMonthKey(now);
  const entries  = loadEntries().filter(e => toMonthKey(new Date(e.date)) === monthKey);
  const sum      = entries.reduce((s, e) => s + Number(e.price), 0);
  const budget   = loadBudget();

  const labelEl  = document.getElementById('monthSummaryLabel');
  const amountEl = document.getElementById('monthSummaryAmount');
  const barWrap  = document.getElementById('budgetBarWrap');
  const barFill  = document.getElementById('budgetBarFill');

  labelEl.textContent = monthLabel(monthKey);

  if (budget !== null) {
    amountEl.textContent = `${sum.toFixed(2)} € / ${budget.toFixed(2)} €`;
    const pct = Math.min((sum / budget) * 100, 100);
    barFill.style.width = `${pct.toFixed(1)}%`;
    barFill.classList.remove('near', 'over');
    if (sum > budget) {
      barFill.classList.add('over');
      amountEl.classList.add('over-budget');
      amountEl.classList.remove('near-budget');
    } else if (pct >= 80) {
      barFill.classList.add('near');
      amountEl.classList.add('near-budget');
      amountEl.classList.remove('over-budget');
    } else {
      amountEl.classList.remove('over-budget', 'near-budget');
    }
    barWrap.hidden = false;
  } else {
    amountEl.textContent = `${sum.toFixed(2)} €`;
    amountEl.classList.remove('over-budget', 'near-budget');
    barWrap.hidden = true;
  }
}

// ── Kategorie-Buttons ──────────────────────────────────────────────────────

document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    catEl.value = btn.dataset.value;
  });
});

// ── Monatlicher Export-Reminder ────────────────────────────────────────────

function wurdeExportiert(monthKey) {
  const liste = JSON.parse(localStorage.getItem(KEY_EXPORTED) || '[]');
  return liste.includes(monthKey);
}

function markiereAlsExportiert(monthKey) {
  const liste = JSON.parse(localStorage.getItem(KEY_EXPORTED) || '[]');
  if (!liste.includes(monthKey)) {
    liste.push(monthKey);
    localStorage.setItem(KEY_EXPORTED, JSON.stringify(liste));
  }
}

/** Erzeugt CSV-String für eine Liste von Einträgen */
function buildCSV(entries) {
  const lines = ['Datum,Preis,Kategorie,Anmerkung'];
  entries.forEach(e => {
    const cat = String(e.category).includes(',')
      ? `"${String(e.category).replace(/"/g, '""')}"`
      : e.category;
    const rem = String(e.remarks || '').includes(',')
      ? `"${String(e.remarks || '').replace(/"/g, '""')}"`
      : (e.remarks || '');
    lines.push(`${e.date},${Number(e.price).toFixed(2)},${cat},${rem}`);
  });
  return lines.join('\n');
}

/** Startet CSV-Download und öffnet Mail-Client */
function exportAndMail(monthKey, entries) {
  const csv      = buildCSV(entries);
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const filename = `ausgaben-${monthKey}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  const subject = encodeURIComponent(`Ausgaben ${monthLabel(monthKey)}`);
  const body    = encodeURIComponent(
    `Hallo,\n\nim Anhang findest du die Ausgaben für ${monthLabel(monthKey)}.\n` +
    `Die CSV-Datei "${filename}" liegt in deinem Download-Ordner.\n\nViele Grüße`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;

  markiereAlsExportiert(monthKey);
  bannerEl.hidden = true;
}

/** Prüft beim App-Start, ob ein Monatsbanner angezeigt werden soll */
function pruefeMonatsExport() {
  const heute       = new Date();
  const vormonat    = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
  const vormonatKey = toMonthKey(vormonat);

  const eintraege = loadEntries().filter(e => toMonthKey(new Date(e.date)) === vormonatKey);

  if (eintraege.length === 0)       return;
  if (wurdeExportiert(vormonatKey)) return;

  const label = monthLabel(vormonatKey);
  const summe = eintraege.reduce((s, e) => s + Number(e.price), 0).toFixed(2);

  document.getElementById('bannerText').textContent =
    `${label}: ${eintraege.length} Einträge, ${summe} € – noch nicht exportiert.`;

  document.getElementById('bannerExportBtn').onclick = () =>
    exportAndMail(vormonatKey, eintraege);

  document.getElementById('bannerSkipBtn').onclick = () => {
    markiereAlsExportiert(vormonatKey);
    bannerEl.hidden = true;
  };

  bannerEl.hidden = false;
}

// ── Liste rendern ──────────────────────────────────────────────────────────

function renderList() {
  const entries = loadEntries();
  listEl.innerHTML = '';
  if (entries.length === 0) {
    listEl.innerHTML = '<li class="small">Keine Einträge.</li>';
    return;
  }
  entries.slice().reverse().forEach(e => {
    const li    = document.createElement('li');
    const left  = document.createElement('div');
    // escapeHtml prevents XSS from user-entered category or remarks text
    const cat     = escapeHtml(e.category);
    const date    = new Date(e.date).toLocaleDateString('de-DE');
    const remarks = e.remarks ? `<div class="entry-remark">${escapeHtml(e.remarks)}</div>` : '';
    left.innerHTML = `<strong>${cat}</strong><div class="small">${date}</div>${remarks}`;
    const right = document.createElement('div');
    right.textContent = `${Number(e.price).toFixed(2)} €`;
    li.appendChild(left);
    li.appendChild(right);
    listEl.appendChild(li);
  });
}

// ── Speichern ──────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  const price    = parseFloat(priceEl.value);
  const category = catEl.value || 'Sonstiges';
  const remarks  = remarksEl.value.trim();
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
    remarks: remarks
  });
  saveEntries(entries);
  priceEl.value   = '';
  remarksEl.value = '';
  document.querySelectorAll('.cat-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  catEl.value = 'Basis';
  renderList();
  renderMonthSummary();
});

// ── Export-Dialog ──────────────────────────────────────────────────────────

const exportOverlay    = document.getElementById('exportOverlay');
const exportRangeEl    = document.getElementById('exportRange');
const customDatesEl    = document.getElementById('customDates');
const exportFromEl     = document.getElementById('exportFrom');
const exportToEl       = document.getElementById('exportTo');
const exportFilenameEl = document.getElementById('exportFilename');
const exportCountEl    = document.getElementById('exportCount');

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
  if (range === 'thisMonth') {
    name = `ausgaben-${toMonthKey(now)}`;
  } else if (range === 'lastMonth') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    name = `ausgaben-${toMonthKey(lm)}`;
  } else if (range === 'custom') {
    const f = exportFromEl.value || 'von';
    const t = exportToEl.value   || 'bis';
    name = `ausgaben-${f}_${t}`;
  } else {
    name = `ausgaben-gesamt`;
  }
  exportFilenameEl.value = name + '.csv';
}

function updateExportPreview() {
  const { from, to } = getRangeBounds(exportRangeEl.value);
  const all = loadEntries();
  const filtered = all.filter(e => {
    const d = new Date(e.date);
    if (from && d < from) return false;
    if (to   && d > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)) return false;
    return true;
  });
  exportCountEl.textContent = `${filtered.length} Eintrag/Einträge im gewählten Zeitraum.`;
  return filtered;
}

exportBtn.addEventListener('click', () => {
  if (loadEntries().length === 0) { alert('Keine Einträge zum Exportieren.'); return; }
  exportRangeEl.value  = 'thisMonth';
  customDatesEl.hidden = true;
  exportFromEl.value   = '';
  exportToEl.value     = '';
  updateFilename();
  updateExportPreview();
  exportOverlay.classList.remove('hidden');
});

exportRangeEl.addEventListener('change', () => {
  customDatesEl.hidden = exportRangeEl.value !== 'custom';
  updateFilename();
  updateExportPreview();
});

exportFromEl.addEventListener('change', () => { updateFilename(); updateExportPreview(); });
exportToEl.addEventListener('change',   () => { updateFilename(); updateExportPreview(); });

document.getElementById('exportCancelBtn').addEventListener('click', () => {
  exportOverlay.classList.add('hidden');
});

document.getElementById('exportConfirmBtn').addEventListener('click', () => {
  const filtered = updateExportPreview();
  if (filtered.length === 0) { alert('Keine Einträge im gewählten Zeitraum.'); return; }
  const csv      = buildCSV(filtered);
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const filename = exportFilenameEl.value || 'ausgaben.csv';
  const a        = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  exportOverlay.classList.add('hidden');
});

// ── Löschen ────────────────────────────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  if (!confirm('Alle Einträge unwiderruflich löschen?')) return;
  localStorage.removeItem(KEY);
  renderList();
  renderMonthSummary();
});

// ── Start ──────────────────────────────────────────────────────────────────

renderList();
renderMonthSummary();
pruefeMonatsExport();
initTheme();
document.getElementById('versionLabel').textContent = APP_VERSION;

// ── Service Worker ─────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').then(reg => {
    reg.update();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }).catch(() => {});
}
