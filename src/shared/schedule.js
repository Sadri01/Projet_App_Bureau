// Calculs de dates partagés entre le processus principal (rappels) et l'interface.
// Fichier UMD : utilisable via require() et via une balise <script>.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Schedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  // Date locale -> 'YYYY-MM-DD'
  function toDateKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // 'YYYY-MM-DD' -> Date locale à minuit
  function fromDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function parseTime(hhmm) {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function formatTime(minutes) {
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // Lundi de la semaine contenant d
  function startOfWeek(d) {
    const s = startOfDay(d);
    const offset = (s.getDay() + 6) % 7;
    return addDays(s, -offset);
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  // Indique si l'activité a lieu le jour donné (Date à minuit)
  function occursOn(activity, day) {
    const r = activity.recurrence || { type: 'once' };
    const key = toDateKey(day);
    if (Array.isArray(activity.exceptions) && activity.exceptions.includes(key)) return false;
    if (r.type === 'once') return r.date === key;
    if (r.startDate && key < r.startDate) return false;
    if (r.endDate && key > r.endDate) return false;
    if (r.type === 'daily') return true;
    if (r.type === 'weekly') return Array.isArray(r.days) && r.days.includes(day.getDay());
    return false;
  }

  function occurrenceKey(activityId, dateKey) {
    return `${activityId}|${dateKey}`;
  }

  // Toutes les occurrences dont le début est dans [from, to[ (dates à minuit)
  function occurrencesBetween(activities, from, to) {
    const out = [];
    for (let day = startOfDay(from); day < to; day = addDays(day, 1)) {
      const dateKey = toDateKey(day);
      for (const a of activities) {
        if (!occursOn(a, day)) continue;
        const startMin = parseTime(a.start);
        const start = new Date(day.getTime() + startMin * 60000);
        // Corrige les changements d'heure : on recalcule à partir des composantes locales
        start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
        const end = new Date(start.getTime() + (Number(a.duration) || 0) * 60000);
        out.push({
          activity: a,
          dateKey,
          start,
          end,
          key: occurrenceKey(a.id, dateKey),
        });
      }
    }
    out.sort((x, y) => x.start - y.start);
    return out;
  }

  // Répartit les événements d'une même journée en colonnes quand ils se chevauchent
  function layoutDay(events) {
    const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
    const groups = [];
    let current = [];
    let groupEnd = 0;
    for (const ev of sorted) {
      if (current.length && ev.start >= groupEnd) {
        groups.push(current);
        current = [];
      }
      current.push(ev);
      groupEnd = Math.max(groupEnd, ev.end);
    }
    if (current.length) groups.push(current);

    const placed = [];
    for (const group of groups) {
      const columns = [];
      for (const ev of group) {
        let col = columns.findIndex((c) => c[c.length - 1].end <= ev.start);
        if (col === -1) {
          col = columns.length;
          columns.push([]);
        }
        columns[col].push(ev);
        placed.push({ ev, col, cols: 0, group });
      }
      for (const p of placed) if (p.group === group) p.cols = columns.length;
    }
    return placed.map(({ ev, col, cols }) => ({ ev, col, cols }));
  }

  // Bornes d'une période ('day' | 'week' | 'month') autour d'une date
  function periodRange(period, ref) {
    if (period === 'day') {
      const from = startOfDay(ref);
      return { from, to: addDays(from, 1) };
    }
    if (period === 'month') {
      const from = startOfMonth(ref);
      return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) };
    }
    const from = startOfWeek(ref);
    return { from, to: addDays(from, 7) };
  }

  // Totaux prévus / réalisés par activité sur une période
  function summarize(activities, log, from, to) {
    const byId = new Map();
    for (const occ of occurrencesBetween(activities, from, to)) {
      const a = occ.activity;
      if (!byId.has(a.id)) {
        byId.set(a.id, { id: a.id, title: a.title, color: a.color, planned: 0, done: 0, skipped: 0, count: 0 });
      }
      const row = byId.get(a.id);
      const minutes = Number(a.duration) || 0;
      row.planned += minutes;
      row.count += 1;
      const status = log && log[occ.key];
      if (status === 'done') row.done += minutes;
      else if (status === 'skipped') row.skipped += minutes;
    }
    return [...byId.values()].sort((a, b) => b.planned - a.planned);
  }

  function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (!h) return `${m} min`;
    return m ? `${h} h ${pad(m)}` : `${h} h`;
  }

  return {
    DAY_MS,
    pad,
    toDateKey,
    fromDateKey,
    parseTime,
    formatTime,
    addDays,
    startOfDay,
    startOfWeek,
    startOfMonth,
    occursOn,
    occurrenceKey,
    occurrencesBetween,
    layoutDay,
    periodRange,
    summarize,
    formatDuration,
  };
});
