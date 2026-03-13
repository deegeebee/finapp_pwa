// Persistenz: localStorage
const KEY          = 'expenses_v1';
const KEY_EXPORTED = 'exported_months';
const KEY_THEME    = 'theme';

// ── Version (bitte bei jedem Deploy aktualisieren) ─────────────────────────
const APP_VERSION = 'branch: Export';

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
    // Kein gespeicherter Wert → System-Präferenz als Startzustand
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

document.getElementById('themeBtn').addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
});

const priceEl   = document.getElementById('price');
const catEl     = document.getElementById('category');
const saveBtn   = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn  = document.getElementById('clearBtn');
const listEl    = document.getElementById('list');
const bannerEl  = document.getElementById('monthBanner');

// ── Kategorie-Buttons ──────────────────────────────────────────────────────

document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    catEl.value = btn.dataset.value;
  });
});

// ── localStorage-Helfer ────────────────────────────────────────────────────

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function saveEntries(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

// ── Monatlicher Export-Reminder ────────────────────────────────────────────

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
  const lines = ['Datum,Preis,Kategorie'];
  entries.forEach(e => {
    const cat = String(e.category).includes(',')
      ? `"${String(e.category).replace(/"/g, '""')}"`
      : e.category;
    lines.push(`${e.date},${Number(e.price).toFixed(2)},${cat}`);
  });
  return lines.join('\n');
}

/** Startet CSV-Download und öffnet Mail-Client */
function exportAndMail(monthKey, entries) {
  const csv      = buildCSV(entries);
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const filename = `ausgaben-${monthKey}.csv`;

  // 1. CSV herunterladen
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  // 2. Mail-Client öffnen (Datei liegt im Download-Ordner)
  const subject = encodeURIComponent(`Ausgaben ${monthLabel(monthKey)}`);
  const body    = encodeURIComponent(
    `Hallo,\n\nim Anhang findest du die Ausgaben für ${monthLabel(monthKey)}.\n` +
    `Die CSV-Datei "${filename}" liegt in deinem Download-Ordner.\n\nViele Grüße`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;

  // 3. Als exportiert merken & Banner ausblenden
  markiereAlsExportiert(monthKey);
  bannerEl.hidden = true;
}

/** Prüft beim App-Start, ob ein Monatsbanner angezeigt werden soll */
function pruefeMonatsExport() {
  const heute        = new Date();
  const vormonat     = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
  const vormonatKey  = toMonthKey(vormonat);

  // Einträge des Vormonats filtern
  const eintraege = loadEntries().filter(e => toMonthKey(new Date(e.date)) === vormonatKey);

  if (eintraege.length === 0)       return; // keine Daten → kein Banner
  if (wurdeExportiert(vormonatKey)) return; // schon exportiert → kein Banner

  // Banner befüllen und anzeigen
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
    left.innerHTML = `<strong>${e.category}</strong><div class="small">${new Date(e.date).toLocaleString()}</div>`;
    const right = document.createElement('div');
    right.innerHTML = `<div>${Number(e.price).toFixed(2)} €</div>`;
    li.appendChild(left);
    li.appendChild(right);
    listEl.appendChild(li);
  });
}

// ── Event-Listener ─────────────────────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  const price    = parseFloat(priceEl.value);
  const category = catEl.value || 'Sonstiges';
  if (!Number.isFinite(price) || price === 0) {
    alert('Bitte einen gültigen Preis eingeben.');
    return;
  }
  const entries = loadEntries();
  entries.push({
    id: Date.now(),
    date: new Date().toISOString(),
    price: Number(price),
    category: String(category)
  });
  saveEntries(entries);
  priceEl.value = '';
  // Kategorie zurücksetzen auf ersten Button
  document.querySelectorAll('.cat-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  catEl.value = 'Basis';
  renderList();
});

// ── Export-Dialog ──────────────────────────────────────────────────────────

const exportOverlay    = document.getElementById('exportOverlay');
const exportRangeEl    = document.getElementById('exportRange');
const customDatesEl    = document.getElementById('customDates');
const exportFromEl     = document.getElementById('exportFrom');
const exportToEl       = document.getElementById('exportTo');
const exportFilenameEl = document.getElementById('exportFilename');
const exportCountEl    = document.getElementById('exportCount');

/** Returns YYYY-MM-DD string for a Date */
function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

/** Computes from/to Date boundaries for the selected range */
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
    from = null; to = null; // all
  }
  return { from, to };
}

/** Pre-fills filename based on selected range */
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

/** Filters entries and updates the count hint */
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
  exportOverlay.hidden = false;
});

exportRangeEl.addEventListener('change', () => {
  customDatesEl.hidden = exportRangeEl.value !== 'custom';
  updateFilename();
  updateExportPreview();
});

exportFromEl.addEventListener('change', () => { updateFilename(); updateExportPreview(); });
exportToEl.addEventListener('change',   () => { updateFilename(); updateExportPreview(); });

document.getElementById('exportCancelBtn').addEventListener('click', () => {
  exportOverlay.hidden = true;
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
  exportOverlay.hidden = true;
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Alle Einträge unwiderruflich löschen?')) return;
  localStorage.removeItem(KEY);
  renderList();
});

// ── Start ──────────────────────────────────────────────────────────────────

renderList();
pruefeMonatsExport();
initTheme();
document.getElementById('versionLabel').textContent = APP_VERSION;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => { /* ignore */ });
}
