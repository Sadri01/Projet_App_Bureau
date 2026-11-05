const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/shared/schedule');

const japonais = {
  id: 'jp',
  title: 'Japonais',
  color: '#2a78d6',
  start: '19:00',
  duration: 60,
  recurrence: { type: 'weekly', days: [1, 4] },
};

test('semaine commençant le lundi', () => {
  const thursday = new Date(2026, 9, 29);
  assert.equal(S.toDateKey(S.startOfWeek(thursday)), '2026-10-26');
  const sunday = new Date(2026, 10, 1);
  assert.equal(S.toDateKey(S.startOfWeek(sunday)), '2026-10-26');
});

test('récurrence hebdomadaire', () => {
  const from = new Date(2026, 9, 26);
  const occ = S.occurrencesBetween([japonais], from, S.addDays(from, 7));
  assert.deepEqual(
    occ.map((o) => o.dateKey),
    ['2026-10-26', '2026-10-29'],
  );
  assert.equal(occ[0].start.getHours(), 19);
  assert.equal(occ[0].end.getHours(), 20);
  assert.equal(occ[0].key, 'jp|2026-10-26');
});

test('exceptions et bornes de répétition', () => {
  const a = { ...japonais, exceptions: ['2026-10-29'], recurrence: { ...japonais.recurrence, startDate: '2026-10-27', endDate: '2026-11-05' } };
  const from = new Date(2026, 9, 26);
  const keys = S.occurrencesBetween([a], from, S.addDays(from, 14)).map((o) => o.dateKey);
  assert.deepEqual(keys, ['2026-11-02', '2026-11-05']);
});

test('activité ponctuelle et quotidienne', () => {
  const once = { id: 'o', start: '08:30', duration: 30, recurrence: { type: 'once', date: '2026-10-30' } };
  const daily = { id: 'd', start: '07:00', duration: 15, recurrence: { type: 'daily' } };
  const from = new Date(2026, 9, 30);
  const occ = S.occurrencesBetween([once, daily], from, S.addDays(from, 2));
  assert.deepEqual(
    occ.map((o) => `${o.activity.id}@${o.dateKey}`),
    ['d@2026-10-30', 'o@2026-10-30', 'd@2026-10-31'],
  );
});

test('heure stable lors du passage à l’heure d’hiver', () => {
  // Le 25/10/2026 est un jour de changement d'heure en Europe
  const from = new Date(2026, 9, 24);
  const occ = S.occurrencesBetween([{ ...japonais, recurrence: { type: 'daily' } }], from, S.addDays(from, 3));
  assert.ok(occ.every((o) => o.start.getHours() === 19 && o.start.getMinutes() === 0));
});

test('récapitulatif prévu / fait / passé', () => {
  const from = new Date(2026, 9, 26);
  const log = { 'jp|2026-10-26': 'done', 'jp|2026-10-29': 'skipped' };
  const [row] = S.summarize([japonais], log, from, S.addDays(from, 7));
  assert.equal(row.planned, 120);
  assert.equal(row.done, 60);
  assert.equal(row.skipped, 60);
  assert.equal(row.count, 2);
});

test('disposition des activités qui se chevauchent', () => {
  const d = (h, m) => new Date(2026, 9, 26, h, m);
  const placed = S.layoutDay([
    { id: 'a', start: d(9, 0), end: d(10, 0) },
    { id: 'b', start: d(9, 30), end: d(10, 30) },
    { id: 'c', start: d(11, 0), end: d(12, 0) },
  ]);
  const byId = Object.fromEntries(placed.map((p) => [p.ev.id, p]));
  assert.equal(byId.a.cols, 2);
  assert.equal(byId.b.col, 1);
  assert.equal(byId.c.cols, 1);
});

test('formatage des durées', () => {
  assert.equal(S.formatDuration(45), '45 min');
  assert.equal(S.formatDuration(120), '2 h');
  assert.equal(S.formatDuration(95), '1 h 35');
  assert.equal(S.formatTime(1500), '01:00');
});

test('récapitulatif : activités séparées portant le même nom regroupées', () => {
  // Bug signalé : « Sport » le mardi et « Sport » le mercredi apparaissaient deux fois
  const mardi = { id: 's1', title: 'Sport', color: '#1baf7a', start: '18:00', duration: 60, recurrence: { type: 'weekly', days: [2] } };
  const mercredi = { id: 's2', title: ' sport ', color: '#e34948', start: '07:00', duration: 60, recurrence: { type: 'weekly', days: [3] } };
  const from = new Date(2026, 9, 26);
  const log = { 's2|2026-10-28': 'done' };
  const rows = S.summarize([mardi, mercredi, japonais], log, from, S.addDays(from, 7));
  const sport = rows.filter((r) => r.title.trim().toLowerCase() === 'sport');
  assert.equal(sport.length, 1);
  assert.equal(sport[0].planned, 120);
  assert.equal(sport[0].done, 60);
  assert.equal(sport[0].count, 2);
  assert.equal(sport[0].title, 'Sport');
  assert.equal(rows.length, 2);
});
