// Fonctions utilitaires partagées par toutes les fenêtres.
const U = (() => {
  // Palette d'activités/catégories testée pour rester lisible (y compris daltonisme)
  const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

  const STATUS = {
    urgent: { label: 'Urgent', icon: '🔥' },
    normal: { label: 'Normal', icon: '•' },
    termine: { label: 'Terminée', icon: '✓' },
    abandonne: { label: 'Abandonnée', icon: '✕' },
  };

  const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const DAYS_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const DAYS_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  const uid = () => crypto.randomUUID();

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function h(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  // Échéance lisible : « aujourd'hui 18:00 », « demain », « lun. 3 nov. »...
  function fmtDue(iso) {
    const d = new Date(iso);
    const today = Schedule.startOfDay(new Date());
    const diff = Math.round((Schedule.startOfDay(d) - today) / Schedule.DAY_MS);
    const time = d.getHours() || d.getMinutes() ? ` ${fmtTime(d)}` : '';
    if (diff === 0) return `aujourd'hui${time}`;
    if (diff === 1) return `demain${time}`;
    if (diff === -1) return `hier${time}`;
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + time;
  }

  // Valeur pour <input type="datetime-local"> en heure locale
  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${Schedule.toDateKey(d)}T${Schedule.pad(d.getHours())}:${Schedule.pad(d.getMinutes())}`;
  }
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme || 'colore';
  }

  // Couleur de texte lisible sur un fond donné
  function readableOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (r * 299 + g * 587 + b * 114) / 1000 > 165 ? '#1a1a1a' : '#fff';
  }

  const STATUS_ORDER = { urgent: 0, normal: 1, termine: 2, abandonne: 3 };

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (s) return s;
      if (a.status === 'termine' || a.status === 'abandonne') {
        return (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || '');
      }
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  }

  const normalize = (s) =>
    String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

  // Saisie rapide : « Réviser kanji !urgent #travail @demain 18h »
  function parseQuickAdd(text, categories, now = new Date()) {
    let rest = ` ${text} `;
    const out = { status: 'normal', categories: [], due: null };

    rest = rest.replace(/\s!(urgent)?(?=\s)/gi, () => {
      out.status = 'urgent';
      return ' ';
    });

    rest = rest.replace(/\s#([^\s#@!]+)(?=\s)/g, (m, name) => {
      const cat = categories.find((c) => normalize(c.name) === normalize(name));
      if (!cat) return m;
      if (!out.categories.includes(cat.id)) out.categories.push(cat.id);
      return ' ';
    });

    const dueRe = /\s@(\S+)(?:\s+(\d{1,2})(?:h|:)(\d{2})?)?(?=\s)/i;
    rest = rest.replace(dueRe, (m, word, hh, mm) => {
      const w = normalize(word);
      let day = null;
      let hour = hh;
      let min = mm;
      const time = /^(\d{1,2})(?:h|:)(\d{2})?$/.exec(w);
      if (time) {
        day = Schedule.startOfDay(now);
        hour = time[1];
        min = time[2];
      } else if (w === 'auj' || w.startsWith('aujourd')) day = Schedule.startOfDay(now);
      else if (w === 'demain') day = Schedule.addDays(Schedule.startOfDay(now), 1);
      else if (DAYS_FULL.includes(w)) {
        const target = DAYS_FULL.indexOf(w);
        const delta = (target - now.getDay() + 7) % 7 || 7;
        day = Schedule.addDays(Schedule.startOfDay(now), delta);
      } else {
        const dm = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(w);
        if (dm) {
          let year = dm[3] ? Number(dm[3]) : now.getFullYear();
          if (year < 100) year += 2000;
          day = new Date(year, Number(dm[2]) - 1, Number(dm[1]));
          if (!dm[3] && day < Schedule.startOfDay(now)) day.setFullYear(year + 1);
        }
      }
      if (!day) return m;
      if (hour !== undefined) day.setHours(Number(hour), Number(min || 0), 0, 0);
      else day.setHours(9, 0, 0, 0);
      out.due = day.toISOString();
      return ' ';
    });

    out.title = rest.replace(/\s+/g, ' ').trim();
    return out;
  }

  function newTask(fields) {
    return {
      id: uid(),
      title: '',
      status: 'normal',
      categories: [],
      due: null,
      notes: '',
      subtasks: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
      ...fields,
    };
  }

  let toastTimer = null;
  function toast(message, type = '') {
    let el = $('#toast');
    if (!el) {
      el = h('<div id="toast" class="toast"></div>');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = 'toast'), 3200);
  }

  function swatchesHtml(selected, name = 'color') {
    const custom = PALETTE.includes(selected) ? '#888888' : selected;
    return `<div class="swatches" data-swatches="${name}">
      ${PALETTE.map((c) => `<button type="button" class="swatch ${c === selected ? 'selected' : ''}" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('')}
      <input type="color" class="swatch-custom" value="${esc(custom)}" title="Autre couleur">
    </div>`;
  }

  // Branche le choix de couleur ; renvoie une fonction qui lit la valeur
  function bindSwatches(root, initial) {
    let value = initial;
    const box = $('.swatches', root);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.swatch');
      if (!b) return;
      value = b.dataset.color;
      $$('.swatch', box).forEach((s) => s.classList.toggle('selected', s === b));
    });
    $('.swatch-custom', box).addEventListener('input', (e) => {
      value = e.target.value;
      $$('.swatch', box).forEach((s) => s.classList.remove('selected'));
    });
    return () => value;
  }

  return {
    PALETTE,
    STATUS,
    DAYS_SHORT,
    DAYS_LETTER,
    DAYS_FULL,
    uid,
    esc,
    $,
    $$,
    h,
    fmtTime,
    fmtDay,
    fmtShort,
    fmtDue,
    toLocalInput,
    fromLocalInput,
    applyTheme,
    readableOn,
    sortTasks,
    normalize,
    parseQuickAdd,
    newTask,
    toast,
    swatchesHtml,
    bindSwatches,
  };
})();
