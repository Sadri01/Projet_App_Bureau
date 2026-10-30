// La saisie rapide vit dans l'interface : on charge le script dans un contexte isolé.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ crypto: globalThis.crypto, console });
for (const f of ['src/shared/schedule.js', 'src/renderer/js/common.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const U = vm.runInContext('U', ctx);
const cats = [
  { id: 'c1', name: 'Sport' },
  { id: 'c2', name: 'Études' },
];
const now = new Date(2026, 9, 30, 10, 0); // vendredi

test('titre simple', () => {
  const p = U.parseQuickAdd('Acheter du riz', cats, now);
  assert.equal(p.title, 'Acheter du riz');
  assert.equal(p.status, 'normal');
  assert.equal(p.due, null);
});

test('urgent, catégories (sans accents) et échéance', () => {
  const p = U.parseQuickAdd('Réviser kanji !urgent #etudes #sport @demain 18h', cats, now);
  assert.equal(p.title, 'Réviser kanji');
  assert.equal(p.status, 'urgent');
  assert.deepEqual([...p.categories], ['c2', 'c1']);
  const d = new Date(p.due);
  assert.equal(d.getDate(), 31);
  assert.equal(d.getHours(), 18);
});

test('jour de la semaine, date et heure seule', () => {
  assert.equal(new Date(U.parseQuickAdd('Courir @lundi', cats, now).due).getDate(), 2);
  const d = new Date(U.parseQuickAdd('Dentiste @12/11 9h30', cats, now).due);
  assert.equal(d.getMonth(), 10);
  assert.equal(d.getMinutes(), 30);
  const t = new Date(U.parseQuickAdd('Appeler maman @20h', cats, now).due);
  assert.equal(t.getDate(), 30);
  assert.equal(t.getHours(), 20);
});

test('catégorie inconnue laissée dans le titre', () => {
  const p = U.parseQuickAdd('Lire #roman', cats, now);
  assert.equal(p.title, 'Lire #roman');
  assert.equal(p.categories.length, 0);
});
