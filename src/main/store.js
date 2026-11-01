// Stockage des données dans un fichier JSON local (dossier utilisateur de l'appli).
const fs = require('fs');
const path = require('path');

const BACKUPS_KEPT = 10;

const DEFAULT_SETTINGS = {
  theme: 'colore',
  autoLaunch: false,
  startHidden: true,
  sound: 'carillon',
  customSoundPath: '',
  volume: 0.7,
  reminderDefault: 10,
  dndUntil: 0,
  dayStart: 6,
  dayEnd: 24,
  notifyTasks: true,
  notifyImported: true,
  pomodoroOnGo: false,
  pomodoro: { work: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLong: 4 },
  shortcuts: {
    quickAdd: 'Control+Alt+T',
    widgetsFront: 'Control+Alt+W',
    showMain: 'Control+Alt+P',
  },
  widgets: {
    todo: { visible: false, bounds: null },
    edt: { visible: false, bounds: null },
    opacity: 0.92,
  },
  icsFeeds: [],
};

const DEFAULT_DATA = {
  version: 1,
  activities: [],
  tasks: [],
  categories: [
    { id: 'cat-travail', name: 'Travail', color: '#2a78d6' },
    { id: 'cat-sport', name: 'Sport', color: '#1baf7a' },
    { id: 'cat-perso', name: 'Perso', color: '#eb6834' },
  ],
  log: {},
  importedEvents: [],
  boards: [],
  settings: DEFAULT_SETTINGS,
};

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Fusion profonde : complète les données chargées avec les valeurs par défaut
function withDefaults(defaults, value) {
  if (!isObject(defaults)) return value === undefined ? defaults : value;
  const out = { ...defaults };
  if (!isObject(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    out[k] = k in defaults ? withDefaults(defaults[k], v) : v;
  }
  return out;
}

class Store {
  constructor(dir) {
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
      return structuredClone(DEFAULT_DATA);
    }
  }

  replaceAll(raw) {
    this.data = withDefaults(DEFAULT_DATA, raw);
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

  upsert(collection, item) {
    const list = this.data[collection];
    if (!Array.isArray(list)) throw new Error(`Collection inconnue : ${collection}`);
    const i = list.findIndex((x) => x.id === item.id);
    if (i === -1) list.push(item);
    else list[i] = item;
    this.save();
  }

  remove(collection, id) {
    const list = this.data[collection];
    if (!Array.isArray(list)) throw new Error(`Collection inconnue : ${collection}`);
    this.data[collection] = list.filter((x) => x.id !== id);
    this.save();
  }

  setLog(key, value) {
    if (value) this.data.log[key] = value;
    else delete this.data.log[key];
    this.save();
  }

  setSettings(partial) {
    this.data.settings = withDefaults(this.data.settings, partial);
    this.save();
    return this.data.settings;
  }
}

module.exports = { Store, DEFAULT_SETTINGS, withDefaults };
