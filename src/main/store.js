// Stockage des données dans un fichier JSON local (dossier utilisateur de l'appli).
const fs = require('fs');
const path = require('path');
const { Model, DEFAULT_SETTINGS, DEFAULT_DATA, withDefaults } = require('../shared/data');

const BACKUPS_KEPT = 10;

class Store extends Model {
  constructor(dir) {
    super({});
    this.dir = dir;
    this.file = path.join(dir, 'donnees.json');
    this.backupDir = path.join(dir, 'sauvegardes');
    this.saveTimer = null;
    this.data = this.load();
    this.dailyBackup();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return withDefaults(DEFAULT_DATA, raw);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Fichier corrompu : on le met de côté plutôt que de l'écraser
        try {
          fs.copyFileSync(this.file, `${this.file}.corrompu-${Date.now()}`);
        } catch {}
      }
      return withDefaults(DEFAULT_DATA, {});
    }
  }

  replaceAll(raw) {
    super.replaceAll(raw);
    this.saveNow();
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 300);
  }

  saveNow() {
    clearTimeout(this.saveTimer);
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  // Une copie par jour, on garde les plus récentes
  dailyBackup() {
    if (!fs.existsSync(this.file)) return;
    fs.mkdirSync(this.backupDir, { recursive: true });
    const name = `donnees-${new Date().toISOString().slice(0, 10)}.json`;
    const target = path.join(this.backupDir, name);
    if (!fs.existsSync(target)) fs.copyFileSync(this.file, target);
    const files = fs
      .readdirSync(this.backupDir)
      .filter((f) => f.startsWith('donnees-'))
      .sort();
    for (const f of files.slice(0, Math.max(0, files.length - BACKUPS_KEPT))) {
      fs.unlinkSync(path.join(this.backupDir, f));
    }
  }
}

module.exports = { Store, DEFAULT_SETTINGS, withDefaults };
