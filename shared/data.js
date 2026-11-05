// Modèle de données commun au PC (Electron) et au téléphone (appli web).
// Chaque modification est datée, et chaque suppression laisse une trace,
// pour pouvoir fusionner les données de deux appareils sans rien perdre.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DataModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
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
    // Date de la dernière modification de chaque entrée de log (fait / passé)
    logUpdated: {},
    // Traces des suppressions : { 'tasks:id': date }
    deleted: {},
    importedEvents: [],
    boards: [],
    settings: DEFAULT_SETTINGS,
  };

  function isObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  // Fusion profonde : complète les données chargées avec les valeurs par défaut.
  // Les valeurs par défaut sont toujours copiées, jamais partagées entre deux jeux de données.
  function withDefaults(defaults, value) {
    if (!isObject(defaults)) {
      if (value !== undefined) return value;
      return defaults && typeof defaults === 'object' ? structuredClone(defaults) : defaults;
    }
    const v = isObject(value) ? value : {};
    const out = {};
    for (const k of Object.keys(defaults)) out[k] = withDefaults(defaults[k], v[k]);
    for (const [k, x] of Object.entries(v)) if (!(k in defaults)) out[k] = x;
    return out;
  }

  const now = () => new Date().toISOString();

  class Model {
    constructor(raw) {
      this.data = withDefaults(DEFAULT_DATA, raw);
    }

    // À redéfinir : enregistrement (fichier sur PC, base du navigateur sur téléphone)
    save() {}

    replaceAll(raw) {
      this.data = withDefaults(DEFAULT_DATA, raw);
      this.save();
    }

    list(collection) {
      const list = this.data[collection];
      if (!Array.isArray(list)) throw new Error(`Collection inconnue : ${collection}`);
      return list;
    }

    upsert(collection, item) {
      const list = this.list(collection);
      const stamped = { ...item, updatedAt: now() };
      const i = list.findIndex((x) => x.id === item.id);
      if (i === -1) list.push(stamped);
      else list[i] = stamped;
      delete this.data.deleted[`${collection}:${item.id}`];
      this.save();
      return stamped;
    }

    remove(collection, id) {
      this.data[collection] = this.list(collection).filter((x) => x.id !== id);
      this.data.deleted[`${collection}:${id}`] = now();
      this.save();
    }

    setLog(key, value) {
      if (value) this.data.log[key] = value;
      else delete this.data.log[key];
      this.data.logUpdated[key] = now();
      this.save();
    }

    setSettings(partial) {
      this.data.settings = withDefaults(this.data.settings, partial);
      this.save();
      return this.data.settings;
    }
  }

  return { DEFAULT_SETTINGS, DEFAULT_DATA, withDefaults, Model };
});
