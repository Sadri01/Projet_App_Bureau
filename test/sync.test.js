const test = require('node:test');
const assert = require('node:assert/strict');
const Sync = require('../src/shared/sync');
const { Model } = require('../src/shared/data');

const T = (m) => `2026-11-0${m}T10:00:00.000Z`;

function device() {
  return new Model({ categories: [] });
}

test('aller-retour du code (compression)', async () => {
  const pc = device();
  pc.upsert('tasks', { id: 't1', title: 'Réviser les kanji 漢字', status: 'urgent' });
  const code = await Sync.encode(Sync.payload(pc.data));
  assert.ok(code.startsWith('MP1.'));
  assert.ok(/^[A-Za-z0-9._-]+$/.test(code), 'code copiable sans caractères spéciaux');
  // Une messagerie qui coupe le code en plusieurs lignes ne doit pas le casser
  const back = await Sync.decode(code.replace(/(.{40})/g, '$1\n '));
  assert.equal(back.tasks[0].title, 'Réviser les kanji 漢字');
});

test('code abîmé ou étranger', async () => {
  await assert.rejects(Sync.decode('bonjour'), /MP1/);
  const code = await Sync.encode(Sync.payload(device().data));
  await assert.rejects(Sync.decode(code.slice(0, code.length - 10)), /incomplet/);
  assert.throws(() => Sync.merge(device().data, { tasks: [] }), /Mon Planning/);
});

test('ajouts des deux côtés, la modification la plus récente gagne', () => {
  const pc = device();
  const tel = device();
  pc.data.tasks = [
    { id: 'a', title: 'A (PC, ancien)', updatedAt: T(1) },
    { id: 'b', title: 'B (PC, récent)', updatedAt: T(3) },
    { id: 'p', title: 'Seulement sur PC', updatedAt: T(1) },
  ];
  tel.data.tasks = [
    { id: 'a', title: 'A (téléphone, récent)', updatedAt: T(2) },
    { id: 'b', title: 'B (téléphone, ancien)', updatedAt: T(2) },
    { id: 't', title: 'Seulement sur téléphone', updatedAt: T(1) },
  ];
  const { data, summary } = Sync.merge(pc.data, Sync.payload(tel.data));
  const byId = Object.fromEntries(data.tasks.map((t) => [t.id, t.title]));
  assert.deepEqual(byId, { a: 'A (téléphone, récent)', b: 'B (PC, récent)', p: 'Seulement sur PC', t: 'Seulement sur téléphone' });
  assert.equal(summary.added.tasks, 1);
  assert.equal(summary.updated.tasks, 1);
  // Dans l'autre sens on obtient le même résultat
  const back = Sync.merge(tel.data, Sync.payload(pc.data)).data;
  assert.deepEqual(Object.fromEntries(back.tasks.map((t) => [t.id, t.title])), byId);
});

test('une suppression se propage, sauf si l’élément a été modifié après', () => {
  const pc = device();
  const tel = device();
  pc.upsert('activities', { id: 'x', title: 'Sport' });
  pc.upsert('activities', { id: 'y', title: 'Japonais' });
  // Le téléphone reçoit tout, puis supprime « Sport »
  tel.data = Sync.merge(tel.data, Sync.payload(pc.data)).data;
  tel.remove('activities', 'x');
  // Pendant ce temps le PC modifie « Japonais » puis le téléphone le supprime avant : la modif gagne
  tel.data.deleted['activities:y'] = '2000-01-01T00:00:00.000Z';
  const { data, summary } = Sync.merge(pc.data, Sync.payload(tel.data));
  assert.deepEqual(data.activities.map((a) => a.id), ['y']);
  assert.equal(summary.removed.activities, 1);
  // Une suppression reçue ne fait pas réapparaître l'élément à la synchro suivante
  pc.data = data;
  const again = Sync.merge(tel.data, Sync.payload(pc.data)).data;
  assert.deepEqual(again.activities.map((a) => a.id), ['y']);
});

test('séances faites / passées', () => {
  const pc = device();
  const tel = device();
  pc.setLog('jp|2026-11-03', 'done');
  tel.data.log['sp|2026-11-04'] = 'skipped';
  tel.data.logUpdated['sp|2026-11-04'] = new Date(Date.now() + 1000).toISOString();
  let { data } = Sync.merge(pc.data, Sync.payload(tel.data));
  assert.deepEqual(data.log, { 'jp|2026-11-03': 'done', 'sp|2026-11-04': 'skipped' });
  // Décocher sur le téléphone (plus récent) se propage
  tel.data = Sync.merge(tel.data, Sync.payload(data)).data;
  tel.data.log = { ...tel.data.log };
  delete tel.data.log['jp|2026-11-03'];
  tel.data.logUpdated['jp|2026-11-03'] = new Date(Date.now() + 5000).toISOString();
  data = Sync.merge(data, Sync.payload(tel.data)).data;
  assert.deepEqual(data.log, { 'sp|2026-11-04': 'skipped' });
});

test('feuilles de brainstorming facultatives, réglages jamais synchronisés', () => {
  const pc = device();
  const tel = device();
  pc.upsert('boards', { id: 'b1', name: 'Idées', items: [] });
  pc.setSettings({ theme: 'survie' });
  const sans = Sync.merge(tel.data, Sync.payload(pc.data, { includeBoards: false })).data;
  assert.equal(sans.boards.length, 0);
  const avec = Sync.merge(tel.data, Sync.payload(pc.data)).data;
  assert.equal(avec.boards[0].name, 'Idées');
  assert.equal(avec.settings.theme, 'colore');
});

test('agendas importés : le téléphone reprend ceux du PC', () => {
  const pc = device();
  pc.data.settings.icsFeeds = [{ id: 'f', name: 'Google', url: 'https://x' }];
  pc.data.importedEvents = [{ uid: 'e1', title: 'Cours', start: T(4), end: T(4) }];
  const tel = Sync.merge(device().data, Sync.payload(pc.data)).data;
  assert.equal(tel.importedEvents.length, 1);
  // Le PC garde les siens
  const back = Sync.merge(pc.data, Sync.payload({ ...device().data })).data;
  assert.equal(back.importedEvents.length, 1);
});

test('describe résume les changements', () => {
  assert.equal(
    Sync.describe({ added: { tasks: 2, activities: 1 }, updated: {}, removed: { activities: 1 }, log: 1 }),
    'Ajouté : 2 tâches, 1 activité · Supprimé : 1 activité · 1 séance cochée',
  );
  assert.match(Sync.describe({ added: {}, updated: {}, removed: {}, log: 0 }), /déjà à jour/);
});
