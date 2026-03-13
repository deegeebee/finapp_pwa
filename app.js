// Einfachste Persistenz: localStorage unter Schlüssel "expenses_v1"
const KEY = 'expenses_v1';

const priceEl = document.getElementById('price');
const catEl = document.getElementById('category');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const listEl = document.getElementById('list');

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function saveEntries(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

function renderList() {
  const entries = loadEntries();
  listEl.innerHTML = '';
  if (entries.length === 0) {
    listEl.innerHTML = '<li class="small">Keine Einträge.</li>';
    return;
  }
  entries.slice().reverse().forEach(e => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<strong>${e.category}</strong><div class="small">${new Date(e.date).toLocaleString()}</div>`;
    const right = document.createElement('div');
    right.innerHTML = `<div>${Number(e.price).toFixed(2)} €</div>`;
    li.appendChild(left);
    li.appendChild(right);
    listEl.appendChild(li);
  });
}

function addEntry(price, category) {
  if (!Number.isFinite(price) || isNaN(price)) return false;
  const entries = loadEntries();
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    price: Number(price),
    category: String(category)
  };
  entries.push(entry);
  saveEntries(entries);
  return true;
}

saveBtn.addEventListener('click', () => {
  const price = parseFloat(priceEl.value);
  const category = catEl.value || 'Sonstiges';
  if (!Number.isFinite(price) || price === 0) {
    alert('Bitte einen gültigen Preis eingeben.');
    return;
  }
  const ok = addEntry(price, category);
  if (ok) {
    priceEl.value = '';
    catEl.selectedIndex = 0;
    renderList();
  }
});

exportBtn.addEventListener('click', () => {
  const entries = loadEntries();
  if (entries.length === 0) {
    alert('Keine Einträge zum Exportieren.');
    return;
  }
  // CSV-Header: Datum,Preis,Kategorie
  const lines = ['Datum,Preis,Kategorie'];
  // Datumsformat ISO, Dezimalpunkt als Trennzeichen (CSV-kompatibel)
  entries.forEach(e => {
    // Escape Kategorie falls Komma enthalten
    const cat = String(e.category).includes(',') ? `"${String(e.category).replace(/"/g,'""')}"` : e.category;
    lines.push(`${e.date},${Number(e.price).toFixed(2)},${cat}`);
  });
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Alle Einträge unwiderruflich löschen?')) return;
  localStorage.removeItem(KEY);
  renderList();
});

// Initial render
renderList();

// Optional: Register Service Worker (falls vorhanden)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(()=>{ /* ignore */ });
}
