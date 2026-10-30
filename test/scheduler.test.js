const test = require('node:test');
const assert = require('node:assert/strict');
const { Scheduler } = require('../src/main/scheduler');
const { DEFAULT_SETTINGS, withDefaults } = require('../src/main/store');

function fakeStore(data) {
  return {
    data: {
      activities: [],
      tasks: [],
      importedEvents: [],
      log: {},
      ...data,
      settings: withDefaults(DEFAULT_SETTINGS, data.settings),
    },
  };
}

const activity = {
  id: 'jp',
  title: 'Japonais',
  start: '19:00',
  duration: 60,
  recurrence: { type: 'once', date: '2026-10-30' },
};

test('rappel avant puis pop-up au début de l’activité, une seule fois', () => {
  const fired = [];
  const s = new Scheduler(fakeStore({ activities: [activity] }), (p) => fired.push(p));
  s.tick(new Date(2026, 9, 30, 18, 49));
  assert.equal(fired.length, 0);
  s.tick(new Date(2026, 9, 30, 18, 50, 5));
  assert.deepEqual(fired.map((p) => p.phase), ['before']);
  s.tick(new Date(2026, 9, 30, 19, 0, 10));
  s.tick(new Date(2026, 9, 30, 19, 0, 25));
  assert.deepEqual(fired.map((p) => p.phase), ['before', 'start']);
  assert.equal(fired[1].occKey, 'jp|2026-10-30');
});

test('rappel désactivé et ne pas déranger', () => {
  const fired = [];
  const store = fakeStore({ activities: [{ ...activity, reminder: 0 }] });
  const s = new Scheduler(store, (p) => fired.push(p));
  s.tick(new Date(2026, 9, 30, 18, 50, 5));
  assert.equal(fired.length, 0);
  store.data.settings.dndUntil = new Date(2026, 9, 30, 20).getTime();
  s.tick(new Date(2026, 9, 30, 19, 0, 5));
  assert.equal(fired.length, 0);
});

test('un rappel trop ancien (PC éteint) n’est pas affiché', () => {
  const fired = [];
  const s = new Scheduler(fakeStore({ activities: [activity] }), (p) => fired.push(p));
  s.tick(new Date(2026, 9, 30, 19, 30));
  assert.equal(fired.length, 0);
});

test('rappel reporté de 5 minutes', () => {
  const fired = [];
  const s = new Scheduler(fakeStore({}), (p) => fired.push(p));
  const realNow = Date.now;
  Date.now = () => new Date(2026, 9, 30, 19, 0).getTime();
  s.snooze({ kind: 'activity', title: 'Japonais', phase: 'start' }, 5);
  Date.now = realNow;
  s.tick(new Date(2026, 9, 30, 19, 4));
  assert.equal(fired.length, 0);
  s.tick(new Date(2026, 9, 30, 19, 5, 1));
  assert.equal(fired.length, 1);
  assert.equal(fired[0].snoozed, true);
});

test('échéance de tâche', () => {
  const fired = [];
  const due = new Date(2026, 9, 30, 12, 0).toISOString();
  const s = new Scheduler(
    fakeStore({
      tasks: [
        { id: 't1', title: 'Rendre le devoir', status: 'urgent', due },
        { id: 't2', title: 'Déjà fait', status: 'termine', due },
      ],
    }),
    (p) => fired.push(p),
  );
  s.tick(new Date(2026, 9, 30, 12, 0, 10));
  assert.equal(fired.length, 1);
  assert.equal(fired[0].taskId, 't1');
  assert.equal(fired[0].urgent, true);
});
