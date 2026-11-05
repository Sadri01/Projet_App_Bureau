// Version téléphone (appli web) : remplace le processus principal d'Electron.
// Même interface `api` que sur PC, mais tout se passe dans la page :
// données dans le navigateur (IndexedDB), rappels et Pomodoro tant que l'appli est ouverte.
(() => {
  const VERSION = '__VERSION__';
  const DB_NAME = 'mon-planning';
  const DB_KEY = 'donnees';

  document.documentElement.classList.add('is-web');

  // ---------- Base de données du navigateur ----------

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbGet(db) {
    return new Promise((resolve, reject) => {
      const req = db.transaction('kv').objectStore('kv').get(DB_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbPut(db, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  class WebStore extends DataModel.Model {
    constructor(db, raw) {
      super(raw);
      this.db = db;
      this.timer = null;
    }

    save() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.saveNow(), 300);
    }

    saveNow() {
      clearTimeout(this.timer);
      return dbPut(this.db, this.data).catch((err) => console.error('Enregistrement impossible', err));
    }
  }

  // ---------- Diffusion des changements (équivalent des messages IPC) ----------

  const listeners = {};
  const on = (channel, cb) => {
    (listeners[channel] ||= new Set()).add(cb);
    return () => listeners[channel].delete(cb);
  };
  const emit = (channel, payload) => {
    for (const cb of listeners[channel] || []) setTimeout(() => cb(payload), 0);
  };

  // Une copie, comme les messages IPC du PC : l'interface ne modifie jamais les données directement
  function publicState() {
    const rest = { ...store.data };
    delete rest.boards;
    return structuredClone(rest);
  }
  const broadcastState = () => emit('state', publicState());

  let store;
  let scheduler;
  let pomodoro;
  const ready = (async () => {
    const db = await openDb();
    store = new WebStore(db, (await dbGet(db)) || {});
    // Demande au navigateur de ne pas effacer les données pour faire de la place
    navigator.storage?.persist?.().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') store.saveNow();
    });

    pomodoro = new Pomodoro(
      () => store.data.settings.pomodoro,
      (state) => emit('pomodoro', state),
      (finished, next, label) => {
        if (store.data.settings.dndUntil > Date.now()) return;
        notify({
          kind: 'pomodoro',
          phase: finished,
          title: finished === 'work' ? 'Bravo, session terminée !' : 'Fin de la pause',
          nextLabel: label,
          color: next === 'work' ? '#e5484d' : '#22b07d',
          start: Date.now(),
        });
      },
    );
    scheduler = new Scheduler(store, notify);
    scheduler.start();
  })();

  // ---------- Pop-ups de rappel ----------

  const queue = [];
  let current = null;

  function notify(payload) {
    queue.push({ ...payload, notifId: crypto.randomUUID() });
    showNext();
  }

  async function systemNotification(p) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    const body = p.end ? `${U.fmtTime(p.start)} – ${U.fmtTime(p.end)}` : PopupContent.describe(p).when;
    const options = { body, tag: p.notifId, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', vibrate: [200, 100, 200] };
    if (reg) reg.showNotification(p.title, options);
    else new Notification(p.title, options);
  }

  function showNext() {
    if (current || !queue.length) return;
    current = queue.shift();
    let box = document.getElementById('web-popup');
    if (!box) {
      box = document.createElement('div');
      box.id = 'web-popup';
      document.body.appendChild(box);
    }
    box.innerHTML = PopupContent.html(current);
    box.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => popupAction(b.dataset.a)));
    if (current.kind !== 'update') {
      Sounds.play(store.data.settings);
      navigator.vibrate?.([200, 100, 200]);
    }
    // Appli en arrière-plan : notification Android en plus
    if (document.visibilityState === 'hidden' && current.kind !== 'update') systemNotification(current);
  }

  function popupAction(action) {
    const p = current;
    if (!p) return;
    if (action === 'snooze') scheduler.snooze(p, 5);
    if (p.kind === 'activity' && p.phase === 'start') {
      if (action === 'done') {
        store.setLog(p.occKey, 'done');
        if (store.data.settings.pomodoroOnGo) {
          pomodoro.reset();
          pomodoro.start(p.title);
        }
      }
      if (action === 'skip') store.setLog(p.occKey, 'skipped');
      broadcastState();
    }
    if (p.kind === 'task' && action === 'done') {
      const task = store.data.tasks.find((t) => t.id === p.taskId);
      if (task) {
        store.upsert('tasks', { ...task, status: 'termine', completedAt: new Date().toISOString() });
        broadcastState();
      }
    }
    if (action === 'open') emit('navigate', p.kind === 'task' ? 'todo' : 'agenda');
    if (p.kind === 'update' && action === 'install') applyUpdate();
    current = null;
    const box = document.getElementById('web-popup');
    if (box) box.innerHTML = '';
    showNext();
  }

  // ---------- Mises à jour de l'appli (service worker) ----------

  let updateStatus = { state: 'web', version: VERSION };
  let waitingWorker = null;

  function setUpdate(partial) {
    updateStatus = { ...updateStatus, ...partial };
    emit('update-status', updateStatus);
  }

  function applyUpdate() {
    if (waitingWorker) waitingWorker.postMessage('activer');
    else location.reload();
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      store?.saveNow().finally(() => location.reload());
    });
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        const watch = (worker) => {
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = worker;
              setUpdate({ state: 'ready' });
              notify({ kind: 'update', web: true, phase: 'ready', title: 'Mise à jour disponible', color: '#1baf7a', start: Date.now() });
            }
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) {
          waitingWorker = reg.waiting;
          setUpdate({ state: 'ready' });
        }
        reg.addEventListener('updatefound', () => watch(reg.installing));
        // Vérifie régulièrement si une nouvelle version a été publiée
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
      })
      .catch((err) => console.warn('Service worker indisponible', err));
  }

  // Bouton « Installer l'appli » d'Android
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    emit('install-available', true);
  });

  // ---------- Fichiers ----------

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();
  const unsupported = (what) => Promise.reject(new Error(`${what} n'est disponible que sur l'appli PC.`));

  // ---------- Interface identique à celle du PC ----------

  window.api = {
    getState: async () => (await ready, publicState()),
    onState: (cb) => on('state', cb),
    onNavigate: (cb) => on('navigate', cb),

    upsert: async (collection, item) => {
      await ready;
      store.upsert(collection, item);
      broadcastState();
    },
    remove: async (collection, id) => {
      await ready;
      store.remove(collection, id);
      if (collection === 'categories') {
        for (const t of store.data.tasks) t.categories = (t.categories || []).filter((c) => c !== id);
      }
      broadcastState();
    },
    setLog: async (key, value) => {
      await ready;
      store.setLog(key, value);
      broadcastState();
    },
    setSettings: async (partial) => {
      await ready;
      store.setSettings(partial);
      if (partial.pomodoro && !pomodoro.running) pomodoro.reset();
      broadcastState();
      return { shortcutErrors: [] };
    },
    setDnd: async (minutes) => {
      await ready;
      let m = minutes;
      if (minutes === 'tomorrow') {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        t.setHours(7, 0, 0, 0);
        m = Math.ceil((t - Date.now()) / 60000);
      }
      store.setSettings({ dndUntil: m > 0 ? Date.now() + m * 60000 : 0 });
      broadcastState();
    },

    pomodoroState: async () => (await ready, pomodoro.state()),
    pomodoro: async (action, arg) => {
      await ready;
      if (action === 'start') pomodoro.start(arg);
      if (action === 'pause') pomodoro.pause();
      if (action === 'reset') pomodoro.reset();
      if (action === 'skip') pomodoro.skip();
      return pomodoro.state();
    },
    onPomodoro: (cb) => on('pomodoro', cb),

    onPopup: (cb) => on('popup', cb),
    popupAction,
    testPopup: async () => {
      await ready;
      notify({ kind: 'activity', phase: 'test', title: 'Test de notification', color: '#7c5cff', start: Date.now() });
    },

    // Fenêtres propres au PC : rien à faire sur téléphone
    onQuickAddReset: () => () => {},
    closeQuickAdd: () => {},
    closeWidget: () => {},
    showMain: (view) => view && emit('navigate', view),

    addFeed: () => unsupported("L'ajout d'un agenda par lien"),
    refreshFeeds: async () => [],
    removeFeed: () => unsupported('La gestion des agendas'),
    importIcsFile: () => unsupported("L'import de fichier .ics"),

    exportData: async () => {
      await ready;
      download(new Blob([JSON.stringify(store.data, null, 2)], { type: 'application/json' }), `mon-planning-${today()}.json`);
      return true;
    },
    importData: async () => {
      const file = await pickFile('application/json,.json');
      if (!file) return false;
      const raw = JSON.parse(await file.text());
      if (!Array.isArray(raw.tasks) || !Array.isArray(raw.activities)) throw new Error("Ce fichier n'est pas une sauvegarde de Mon Planning.");
      await ready;
      store.replaceAll(raw);
      await store.saveNow();
      broadcastState();
      return true;
    },
    openBackups: async () => {},

    chooseSound: async () => null,
    readSound: async () => null,

    appInfo: async () => ({ version: VERSION, packaged: true, web: true, dataDir: '' }),

    listBoards: async () => {
      await ready;
      return store.data.boards
        .map(({ id, name, updatedAt }) => ({ id, name, updatedAt: updatedAt || '' }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getBoard: async (id) => (await ready, structuredClone(store.data.boards.find((b) => b.id === id) || null)),
    saveBoard: async (board) => {
      await ready;
      // Copie : l'éditeur continue de modifier son propre tableau entre deux enregistrements
      store.upsert('boards', structuredClone(board));
    },
    deleteBoard: async (id) => {
      await ready;
      store.remove('boards', id);
    },
    copyBoardImage: async (dataUrl) => {
      const blob = await dataUrlToBlob(dataUrl);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    },
    saveBoardImage: async (dataUrl, name) => {
      const blob = await dataUrlToBlob(dataUrl);
      const fileName = `${String(name || 'brainstorming').replace(/[\\/:*?"<>|]+/g, '-')}-${today()}.png`;
      // Sur Android : menu de partage (Galerie, WhatsApp, Drive...)
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name });
          return fileName;
        } catch (err) {
          if (err.name === 'AbortError') return null;
        }
      }
      download(blob, fileName);
      return fileName;
    },

    syncPayload: async (options) => (await ready, Sync.payload(store.data, options)),
    syncMerge: async (incoming) => {
      await ready;
      const { data, summary } = Sync.merge(store.data, incoming);
      store.data = data;
      await store.saveNow();
      broadcastState();
      return Sync.describe(summary);
    },

    updateStatus: async () => updateStatus,
    checkUpdate: async () => {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update().catch(() => {});
      if (updateStatus.state !== 'ready') setUpdate({ state: 'uptodate', checkedAt: Date.now() });
      return updateStatus;
    },
    installUpdate: async () => applyUpdate(),
    onUpdateStatus: (cb) => on('update-status', cb),

    // Spécifique au téléphone
    canInstall: () => Boolean(installPrompt),
    onInstallAvailable: (cb) => on('install-available', cb),
    install: async () => {
      if (!installPrompt) return false;
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      installPrompt = null;
      return outcome === 'accepted';
    },
    notificationPermission: () => ('Notification' in window ? Notification.permission : 'unsupported'),
    requestNotifications: async () => ('Notification' in window ? Notification.requestPermission() : 'unsupported'),
    shareText: async (text, title) => {
      if (!navigator.share) return false;
      try {
        await navigator.share({ text, title });
        return true;
      } catch {
        return false;
      }
    },
    shareFile: async (blob, fileName) => {
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return true;
        } catch (err) {
          if (err.name === 'AbortError') return true;
        }
      }
      download(blob, fileName);
      return true;
    },
    pickFile,
    download,
  };
})();
