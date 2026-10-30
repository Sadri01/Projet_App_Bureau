// Surveille l'heure et déclenche les rappels (activités, tâches, agendas importés).
const S = require('../shared/schedule');

const TICK_MS = 15 * 1000;
// Un rappel manqué (PC en veille...) reste valable pendant ce délai
const GRACE_MS = 3 * 60 * 1000;

class Scheduler {
  constructor(store, notify) {
    this.store = store;
    this.notify = notify;
    this.fired = new Set();
    this.snoozes = [];
    this.timer = null;
  }

  start() {
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
  }

  snooze(payload, minutes) {
    this.snoozes.push({ at: Date.now() + minutes * 60000, payload: { ...payload, snoozed: true } });
  }

  // Liste des rappels prévus autour de maintenant
  dueItems(now) {
    const { activities, tasks, importedEvents, settings } = this.store.data;
    const items = [];
    const from = S.addDays(S.startOfDay(now), -1);
    const to = S.addDays(S.startOfDay(now), 2);

    for (const occ of S.occurrencesBetween(activities, from, to)) {
      const a = occ.activity;
      const base = {
        kind: 'activity',
        occKey: occ.key,
        activityId: a.id,
        title: a.title,
        color: a.color,
        start: occ.start.getTime(),
        end: occ.end.getTime(),
        notes: a.notes || '',
      };
      items.push({ id: `${occ.key}|start`, at: occ.start.getTime(), payload: { ...base, phase: 'start' } });
      const before = a.reminder === undefined ? settings.reminderDefault : Number(a.reminder);
      if (before > 0) {
        items.push({
          id: `${occ.key}|before`,
          at: occ.start.getTime() - before * 60000,
          payload: { ...base, phase: 'before', minutesBefore: before },
        });
      }
    }

    if (settings.notifyTasks) {
      for (const t of tasks) {
        if (!t.due || t.status === 'termine' || t.status === 'abandonne') continue;
        const at = new Date(t.due).getTime();
        items.push({
          id: `task|${t.id}|${t.due}`,
          at,
          payload: { kind: 'task', taskId: t.id, title: t.title, start: at, phase: 'due', urgent: t.status === 'urgent' },
        });
      }
    }

    if (settings.notifyImported) {
      for (const ev of importedEvents) {
        const at = new Date(ev.start).getTime();
        items.push({
          id: `ics|${ev.uid}|${ev.start}`,
          at,
          payload: {
            kind: 'imported',
            title: ev.title,
            color: ev.color,
            start: at,
            end: new Date(ev.end).getTime(),
            phase: 'start',
          },
        });
      }
    }
    return items;
  }

  tick(nowDate = new Date()) {
    const now = nowDate.getTime();
    const dnd = this.store.data.settings.dndUntil > now;
    const toFire = [];

    for (const item of this.dueItems(nowDate)) {
      if (this.fired.has(item.id)) continue;
      if (item.at <= now && item.at > now - GRACE_MS) {
        this.fired.add(item.id);
        if (!dnd) toFire.push(item.payload);
      }
    }

    const pending = [];
    for (const s of this.snoozes) {
      if (s.at <= now) {
        if (!dnd) toFire.push(s.payload);
      } else pending.push(s);
    }
    this.snoozes = pending;

    // Ne pas laisser grossir la mémoire indéfiniment
    if (this.fired.size > 5000) this.fired = new Set([...this.fired].slice(-1000));

    for (const p of toFire) this.notify(p);
    return toFire;
  }
}

module.exports = { Scheduler, GRACE_MS };
