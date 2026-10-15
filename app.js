const $ = (s) => document.querySelector(s);
// True only inside the Electron shell (preload exposes isWidget).
// A bare `window.widget` check is unsafe: some browsers/extensions
// define their own `widget` object without our API, which used to
// throw mid-save and leave the language half-applied.
const isElectron = () => !!(window.widget && window.widget.isWidget);
const state = {
  city: localStorage.getItem('pp_city') || 'Mecca',
  country: localStorage.getItem('pp_country') || 'Saudi Arabia',
  method: +(localStorage.getItem('pp_method') || 4),
  lang: localStorage.getItem('pp_lang') || 'en',
  notify: localStorage.getItem('pp_notify') !== '0',
  remind: +(localStorage.getItem('pp_remind') || 0),
  showTaskbar: localStorage.getItem('pp_taskbar') !== '0',
  compact: localStorage.getItem('pp_compact') === '1',
  startup: localStorage.getItem('pp_startup') === '1',
  trayMin: localStorage.getItem('pp_traymin') !== '0',
  timings: null,
  hijri: null,
  lat: localStorage.getItem('pp_lat') || null,
  lon: localStorage.getItem('pp_lon') || null,
  fired: JSON.parse(localStorage.getItem('pp_fired') || '{}'),
};

const COUNTRIES = ['Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Lucia','San Marino','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

// Ultra-light 1.5px line icons (no emoji)
const S = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICONS = {
  Fajr: S('<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"/>'),
  Sunrise: S('<path d="M4 18h16"/><path d="M8 18a4 4 0 0 1 8 0"/><path d="M12 7V5M6.3 9.3L7.7 10.7M17.7 9.3l-1.4 1.4"/><path d="M12 2v1.5"/>'),
  Dhuhr: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19"/>'),
  Asr: S('<circle cx="8.5" cy="8.5" r="3"/><path d="M8.5 2.5v1.5M2.5 8.5H4M4.3 4.3l1 1M12.7 4.3l-1 1"/><path d="M9 19h10.5a3 3 0 0 0 .6-5.9A4.5 4.5 0 0 0 11.4 14 2.8 2.8 0 0 0 9 19z"/>'),
  Maghrib: S('<path d="M4 16h16"/><path d="M8 16a4 4 0 0 1 8 0"/><path d="M12 5v4M10 7l2 2 2-2"/><path d="M6.3 11.3l1.4-1.4M17.7 11.3l-1.4-1.4"/>'),
  Isha: S('<path d="M18.5 15A7 7 0 1 1 9 5.5a5.6 5.6 0 0 0 9.5 9.5z"/><path d="M18 3.5l.7 1.8 1.8.7-1.8.7L18 8.5l-.7-1.8-1.8-.7 1.8-.7z"/>'),
};
const ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// window controls + drag anywhere (except interactive elements)
(() => {
  $('#btnMin').onclick = () => isElectron() && widget.minimize();
  $('#btnClose').onclick = () => isElectron() && widget.close();
  $('#btnQuit').onclick = () => isElectron() && widget.quit();
  const z = $('#dragZone');
  const Ui = $('#widget');
  let sx, sy, dragging = false;
  const interactive = (el) => el && el.closest
    ? el.closest('button, input, select, textarea, a, label, .combo-list')
    : false;
  Ui.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || interactive(e.target)) return;
    dragging = true; sx = e.screenX; sy = e.screenY;
    z.classList.add('dragging');
  });
  window.addEventListener('mouseup', () => { dragging = false; z.classList.remove('dragging'); });
  window.addEventListener('mousemove', (e) => {
    if (!dragging || !isElectron()) return;
    widget.drag(e.screenX - sx, e.screenY - sy);
    sx = e.screenX; sy = e.screenY;
  });
  // belt-and-suspenders: no text selection outside editable fields
  document.addEventListener('selectstart', (e) => {
    if (!e.target.closest || !e.target.closest('input, select, textarea')) e.preventDefault();
  });
})();

// ---- i18n ----
const t = (k) => (STRINGS[state.lang] && STRINGS[state.lang][k]) || STRINGS.en[k] || k;
const prayerName = (key) => (PRAYER_NAMES[state.lang] && PRAYER_NAMES[state.lang][key]) || key;

function applyLang() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  renderAll();
}

// Compact view: hides the mosque illustration + date block, window auto-fits.
function applyCompact() {
  document.body.classList.toggle('compact', state.compact);
  fitWindow();
}

// Ask Electron to shrink/grow the window to the measured content height
// (the window itself is not user-resizable).
function fitWindow() {
  if (!isElectron()) return;
  requestAnimationFrame(() => {
    const h = document.querySelector('.stage').getBoundingClientRect().height;
    if (h > 0) widget.fit(Math.ceil(h));
  });
}
let pickedCity = null; // { name, lat, lon }
let cityAbort = null;

function closeLists() {
  $('#countryList').hidden = true;
  $('#cityList').hidden = true;
}

function renderList(ul, rows, onPick) {
  ul.innerHTML = '';
  if (!rows.length) {
    ul.innerHTML = '<li class="empty">No matches</li>';
  } else {
    rows.slice(0, 8).forEach((r, i) => {
      const li = document.createElement('li');
      if (i === 0) li.classList.add('active');
      li.innerHTML = r.sub ? `${r.label}<small>${r.sub}</small>` : r.label;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); onPick(r); });
      ul.appendChild(li);
    });
  }
  ul.hidden = false;
}

function wireCombo(input, ul, onEnter) {
  let idx = 0;
  input.addEventListener('keydown', (e) => {
    const items = [...ul.querySelectorAll('li:not(.empty)')];
    if (ul.hidden || !items.length) {
      if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle('active', i === idx));
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[Math.min(idx, items.length - 1)].dispatchEvent(new Event('mousedown'));
    } else if (e.key === 'Escape') {
      ul.hidden = true;
    }
  });
  input.addEventListener('blur', () => setTimeout(closeLists, 120));
  return { resetIndex: () => { idx = 0; } };
}

const countryCombo = wireCombo($('#inCountry'), $('#countryList'));
const cityCombo = wireCombo($('#inCity'), $('#cityList'), () => {
  const first = $('#cityList').querySelector('li:not(.empty)');
  if (first) first.dispatchEvent(new Event('mousedown'));
});

$('#inCountry').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const rows = (q ? COUNTRIES.filter(c => c.toLowerCase().includes(q)) : COUNTRIES)
    .map(c => ({ label: c }));
  countryCombo.resetIndex();
  renderList($('#countryList'), rows, (r) => {
    $('#inCountry').value = r.label;
    $('#cityList').hidden = true;
    $('#countryList').hidden = true;
    pickedCity = null;
    $('#inCity').value = '';
    $('#inCity').focus();
    searchCity('');
  });
});
$('#inCountry').addEventListener('focus', (e) => {
  if (!e.target.value) {
    countryCombo.resetIndex();
    renderList($('#countryList'), COUNTRIES.map(c => ({ label: c })), (r) => {
      $('#inCountry').value = r.label;
      $('#countryList').hidden = true;
      $('#inCity').focus();
    });
  }
});

let cityTimer = null;
async function searchCity(q) {
  const country = $('#inCountry').value.trim();
  const ul = $('#cityList');
  if (cityAbort) cityAbort.abort();
  if (!q.trim()) { ul.hidden = true; return; }
  const query = q.trim().toLowerCase();
  const local = (typeof CITY_INDEX !== 'undefined' && CITY_INDEX[country] ? CITY_INDEX[country] : [])
    .filter(c => c.n.toLowerCase().includes(query))
    .map(c => ({ label: c.n, sub: country, lat: c.la, lon: c.lo }));
  const pick = (sel) => {
    $('#inCity').value = sel.label;
    pickedCity = { name: sel.label, lat: sel.lat, lon: sel.lon };
    closeLists();
  };
  const show = (extra) => {
    cityCombo.resetIndex();
    const seen = new Set();
    renderList(ul, [...local, ...extra].filter(r => {
      const k = r.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }), pick);
  };
  show([]);
  if (local.length >= 8) return; // plenty of local matches, skip network
  cityAbort = new AbortController();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=en&city=${encodeURIComponent(q.trim())}&country=${encodeURIComponent(country)}`;
    const r = await fetch(url, { signal: cityAbort.signal, headers: { Accept: 'application/json' } });
    const j = await r.json();
    show((j || [])
      .filter(n => n.lat)
      .map(n => {
        const parts = (n.display_name || '').split(',').map(s => s.trim());
        return { label: parts[0], sub: parts.slice(1, 3).join(', '), lat: n.lat, lon: n.lon };
      }));
  } catch (_) { /* keep local results */ }
}
$('#inCity').addEventListener('input', (e) => {
  pickedCity = null;
  clearTimeout(cityTimer);
  cityTimer = setTimeout(() => searchCity(e.target.value), 300);
});
$('#inCity').addEventListener('focus', (e) => { if (e.target.value) searchCity(e.target.value); });

// clicking the location header opens settings
$('#locRow').addEventListener('click', () => openSettings());

function openSettings() {
  $('#inCity').value = state.city; $('#inCountry').value = state.country;
  $('#inMethod').value = String(state.method);
  $('#inLang').value = state.lang;
  $('#inNotify').checked = state.notify;
  $('#inRemind').value = String(state.remind);
  $('#inTaskbar').checked = state.showTaskbar;
  $('#inCompact').checked = state.compact;
  $('#inStartup').checked = state.startup;
  $('#inTrayMin').checked = state.trayMin;
  pickedCity = (state.lat && state.lon) ? { name: state.city, lat: state.lat, lon: state.lon } : null;
  closeLists();
  $('#sheet').hidden = !$('#sheet').hidden;
}

// settings sheet
$('#btnSettings').onclick = openSettings;
$('#btnCancel').onclick = () => $('#sheet').hidden = true;
$('#btnTest').onclick = () => sendToast(t('testTitle'), t('testBody'));
$('#btnSave').onclick = () => {
  const country = $('#inCountry').value.trim() || 'Saudi Arabia';
  const city = $('#inCity').value.trim() || 'Mecca';
  // Apply everything instantly — never block settings on the network.
  const locChanged = city !== state.city || country !== state.country;
  state.city = city;
  state.country = country;
  state.method = +$('#inMethod').value;
  state.lang = $('#inLang').value;
  state.notify = $('#inNotify').checked;
  state.remind = +$('#inRemind').value;
  state.showTaskbar = $('#inTaskbar').checked;
  state.compact = $('#inCompact').checked;
  state.startup = $('#inStartup').checked;
  state.trayMin = $('#inTrayMin').checked;
  localStorage.setItem('pp_city', state.city);
  localStorage.setItem('pp_country', state.country);
  localStorage.setItem('pp_method', String(state.method));
  localStorage.setItem('pp_lang', state.lang);
  localStorage.setItem('pp_notify', state.notify ? '1' : '0');
  localStorage.setItem('pp_remind', String(state.remind));
  localStorage.setItem('pp_taskbar', state.showTaskbar ? '1' : '0');
  localStorage.setItem('pp_compact', state.compact ? '1' : '0');
  localStorage.setItem('pp_startup', state.startup ? '1' : '0');
  localStorage.setItem('pp_traymin', state.trayMin ? '1' : '0');
  if (isElectron()) {
    widget.setTaskbar(state.showTaskbar);
    widget.setStartup(state.startup);
    widget.setTrayMin(state.trayMin);
  }
  if (state.notify && 'Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (_) {}
  }
  $('#sheet').hidden = true;
  applyLang();
  applyCompact();
  // Resolve precise coordinates in the background (8s cap), then reload.
  const fast = (pickedCity && pickedCity.name === city)
    ? { lat: pickedCity.lat, lon: pickedCity.lon }
    : null;
  if (fast) {
    setCoords(fast.lat, fast.lon);
    loadTimes();
  } else {
    if (locChanged) {
      // drop stale coordinates so times come from the new city name
      // until the background lookup resolves precise ones
      state.lat = state.lon = null;
      localStorage.removeItem('pp_lat');
      localStorage.removeItem('pp_lon');
    }
    loadTimes();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`, { signal: ctl.signal })
      .then(r => r.json())
      .then(j => {
        if (j && j[0]) {
          const name = (j[0].display_name || '').split(',')[0].trim();
          if (name) state.city = name;
          localStorage.setItem('pp_city', state.city);
          setCoords(j[0].lat, j[0].lon);
          renderAll();
          loadTimes();
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }
};

function setCoords(lat, lon) {
  state.lat = lat; state.lon = lon;
  localStorage.setItem('pp_lat', state.lat);
  localStorage.setItem('pp_lon', state.lon);
}

function sendToast(title, body) {
  if (!state.notify && title !== t('testTitle')) return;
  if (isElectron()) widget.notify(title, body);
  else if ('Notification' in window) {
    if (Notification.permission === 'granted') { try { new Notification(title, { body }); } catch (_) {} }
    else if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { if (p === 'granted') { try { new Notification(title, { body }); } catch (_) {} } });
    }
  }
}

function checkAlerts() {
  if (!state.notify || !state.timings) return;
  const today = new Date().toDateString();
  const list = prayerDates();
  const now = new Date();
  list.forEach(p => {
    const atKey = `${p.key}|${today}|at`;
    const reKey = `${p.key}|${today}|re`;
    if (!state.fired[atKey] && now >= p.date && now - p.date < 60000) {
      state.fired[atKey] = 1;
      const pn = prayerName(p.key);
      if (state.lang === 'ar') sendToast(`حان وقت ${pn}`, `حان وقت صلاة ${pn} — ${shortTime(p.hhmm)} في ${state.city}.`);
      else if (state.lang === 'fr') sendToast(`Heure de ${pn}`, `C'est l'heure de ${pn} — ${shortTime(p.hhmm)} à ${state.city}.`);
      else sendToast(`${pn} time`, `It's time for ${pn} — ${shortTime(p.hhmm)} in ${state.city}.`);
    }
    if (state.remind > 0 && !state.fired[reKey]) {
      const remindAt = new Date(p.date.getTime() - state.remind * 60000);
      if (now >= remindAt && now < p.date) {
        state.fired[reKey] = 1;
        const pn = prayerName(p.key);
        if (state.lang === 'ar') sendToast(`${pn} بعد ${state.remind} د`, `صلاة ${pn} بعد ${state.remind} دقائق — ${shortTime(p.hhmm)}.`);
        else if (state.lang === 'fr') sendToast(`${pn} dans ${state.remind} min`, `${pn} à ${shortTime(p.hhmm)} (${state.city}).`);
        else sendToast(`${pn} in ${state.remind} mins`, `${pn} at ${shortTime(p.hhmm)} (${state.city}).`);
      }
    }
  });
  localStorage.setItem('pp_fired', JSON.stringify(state.fired));
}

function stripTZ(t) { return (t || '').split(' ')[0].slice(0, 5); }
function shortTime(t24) {
  let [h, m] = t24.split(':').map(Number);
  const ap = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}${ap}`;
}
function ddmm(d = new Date()) {
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

async function loadTimes() {
  let url;
  if (state.lat && state.lon) {
    url = `https://api.aladhan.com/v1/timings/${ddmm()}?latitude=${state.lat}&longitude=${state.lon}&method=${state.method}`;
  } else {
    url = `https://api.aladhan.com/v1/timingsByCity/${ddmm()}?city=${encodeURIComponent(state.city)}&country=${encodeURIComponent(state.country)}&method=${state.method}`;
  }
  try {
    const r = await fetch(url);
    const j = await r.json();
    state.timings = j.data.timings;
    state.hijri = j.data.date ? j.data.date.hijri : null;
  } catch (_) {
    state.timings = { Fajr: '04:59', Sunrise: '06:20', Dhuhr: '12:05', Asr: '15:28', Maghrib: '17:51', Isha: '19:21' };
    state.hijri = null;
  }
  renderAll();
}

function prayerDates() {
  const now = new Date();
  return ORDER.map(key => {
    const hhmm = stripTZ(state.timings[key]);
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(now); d.setHours(h, m, 0, 0);
    return { key, hhmm, date: d };
  });
}
function nextPrayer(list, now = new Date()) {
  for (const p of list) if (p.date > now) return p;
  const f = list[0], t = new Date(f.date); t.setDate(t.getDate() + 1);
  return { ...f, date: t };
}

function renderAll() {
  $('#locName').textContent = `${state.city}, ${state.country}`;
  if (state.hijri) {
    const month = state.lang === 'ar' && state.hijri.month.ar ? state.hijri.month.ar : state.hijri.month.en;
    $('#hijriDate').textContent = `${state.hijri.day} ${month} ${state.hijri.year}`;
  } else {
    try { $('#hijriDate').textContent = new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : state.lang === 'fr' ? 'fr-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()); }
    catch (_) { $('#hijriDate').textContent = '—'; }
  }
  $('#gregDate').textContent = new Date().toLocaleDateString(state.lang === 'ar' ? 'ar' : state.lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  renderTimeline();
  tick();
  fitWindow();
}

function renderTimeline() {
  const now = new Date();
  const list = prayerDates();
  const next = nextPrayer(list, now);
  const el = $('#timeline');
  el.innerHTML = '';
  list.forEach(p => {
    const c = document.createElement('div');
    const isNext = p.key === next.key;
    const isDone = p.date <= now;
    c.className = 't-cell' + (isNext ? ' next' : isDone ? ' done' : '');
    c.title = `${prayerName(p.key)} ${shortTime(p.hhmm)}`;
    c.innerHTML = `<span class="pic">${ICONS[p.key]}</span><span class="nm">${prayerName(p.key)}</span><span class="tm">${shortTime(p.hhmm)}</span>`;
    el.appendChild(c);
  });
  const idx = list.findIndex(p => p.key === next.key);
  const prev = idx > 0 ? list[idx - 1] : (() => { const l = prayerDates(); const y = new Date(l[l.length - 1].date); y.setDate(y.getDate() - 1); return { date: y }; })();
  const total = next.date - prev.date, done = now - prev.date;
  $('#dayProgress').style.width = Math.max(0, Math.min(100, done / total * 100)) + '%';
  if (isElectron()) {
    try { widget.setJumpList(list.map(p => `${prayerName(p.key)}  ${shortTime(p.hhmm)}`)); } catch (_) {}
  }
}

function tick() {
  const now = new Date();
  $('#bigTime').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (!state.timings) return;
  const list = prayerDates();
  const next = nextPrayer(list, now);
  const ms = Math.max(0, next.date - now);
  const h = Math.floor(ms / 3.6e6), m = Math.floor(ms % 3.6e6 / 6e4), s = Math.floor(ms % 6e4 / 1000);
  const pn = prayerName(next.key);
  const pad = (n) => String(n).padStart(2, '0');
  if (state.lang === 'ar') {
    $('#nextLabel').textContent = h > 0
      ? `${pn} بعد ${h}س ${pad(m)}د ${pad(s)}ث`
      : `${pn} بعد ${m}د ${pad(s)}ث`;
  } else if (state.lang === 'fr') {
    $('#nextLabel').textContent = h > 0
      ? `${pn} dans ${h}h ${pad(m)}m ${pad(s)}s`
      : `${pn} dans ${m}m ${pad(s)}s`;
  } else {
    $('#nextLabel').textContent = h > 0
      ? `${pn} in ${h}h ${pad(m)}m ${pad(s)}s`
      : `${pn} in ${m}m ${pad(s)}s`;
  }
  if (s === 0) renderTimeline();
  checkAlerts();
  if (isElectron()) {
    const idx = list.findIndex(p => p.key === next.key);
    const prev = idx > 0 ? list[idx - 1] : { date: new Date(next.date.getTime() - 3 * 3600e3) };
    const frac = (now - prev.date) / (next.date - prev.date);
    widget.setProgress(Math.max(0, Math.min(1, frac)));
  }
}
setInterval(tick, 1000);

// boot with saved language (static text + rtl) before first paint of times
document.documentElement.lang = state.lang;
document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
document.body.classList.toggle('compact', state.compact);
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
loadTimes();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitWindow());
else fitWindow();
