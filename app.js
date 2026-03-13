// Persistenz: localStorage
const KEY          = 'expenses_v1';
const KEY_EXPORTED = 'exported_months';

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

exportBtn.addEventListener('click', () => {
  const entries = loadEntries();
  if (entries.length === 0) { alert('Keine Einträge zum Exportieren.'); return; }
  const csv  = buildCSV(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'expenses.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Alle Einträge unwiderruflich löschen?')) return;
  localStorage.removeItem(KEY);
  renderList();
});

// ── Start ──────────────────────────────────────────────────────────────────

renderList();
pruefeMonatsExport();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => { /* ignore */ });
}
