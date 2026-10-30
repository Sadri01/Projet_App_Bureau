// Processus principal : fenêtres, zone de notification, raccourcis, rappels.
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
  screen,
  dialog,
  shell,
  nativeImage,
} = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Store } = require('./store');
const { Scheduler } = require('./scheduler');
const { Pomodoro } = require('./pomodoro');
const ics = require('./ics');

const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', 'preload.js');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
const ICS_REFRESH_MS = 30 * 60 * 1000;
// Fond des widgets : sous Windows une fenêtre transparente ne peut pas être redimensionnée
const THEME_SURFACE = { colore: '#ffffff', sombre: '#181b21', survie: '#22261d' };

// Dossier de données alternatif (tests, ou plusieurs profils)
if (process.env.MON_PLANNING_DATA) app.setPath('userData', process.env.MON_PLANNING_DATA);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.setAppUserModelId('com.sadri01.monplanning');

process.on('unhandledRejection', (err) => console.error('Erreur non gérée :', err));

let store;
let scheduler;
let pomodoro;
let tray = null;
let mainWin = null;
let popupWin = null;
let quickAddWin = null;
const widgetWins = { todo: null, edt: null };
const popupQueue = [];
let popupCurrent = null;
let quitting = false;

const id = () => crypto.randomUUID();

function allWindows() {
  return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
}

function broadcast(channel, payload) {
  for (const w of allWindows()) w.webContents.send(channel, payload);
}

function broadcastState() {
  broadcast('state', store.data);
  const bg = THEME_SURFACE[store.data.settings.theme] || THEME_SURFACE.colore;
  for (const w of Object.values(widgetWins)) if (w && !w.isDestroyed()) w.setBackgroundColor(bg);
  refreshTrayMenu();
}

function baseWebPreferences() {
  return { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true };
}

// ---------- Fenêtre principale ----------

function createMainWindow(show = true) {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Mon Planning',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: baseWebPreferences(),
  });
  mainWin.removeMenu();
  mainWin.loadFile(path.join(RENDERER, 'index.html'));
  mainWin.once('ready-to-show', () => {
    if (show) mainWin.show();
  });
  // Fermer la fenêtre la cache : l'appli reste active pour les rappels
  mainWin.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWin.hide();
    }
  });
}

function showMain(view) {
  if (!mainWin || mainWin.isDestroyed()) createMainWindow(true);
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  if (view) mainWin.webContents.send('navigate', view);
}

// ---------- Widgets de bureau ----------

function defaultWidgetBounds(type) {
  const area = screen.getPrimaryDisplay().workArea;
  const width = 320;
  const height = type === 'todo' ? 420 : 380;
  const x = area.x + area.width - width - 20;
  const y = type === 'todo' ? area.y + 20 : area.y + area.height - height - 20;
  return { x, y, width, height };
}

function boundsVisible(b) {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40;
  });
}

function createWidget(type) {
  if (widgetWins[type] && !widgetWins[type].isDestroyed()) return widgetWins[type];
  const saved = store.data.settings.widgets[type].bounds;
  const bounds = saved && boundsVisible(saved) ? saved : defaultWidgetBounds(type);
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 220,
    minHeight: 160,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: false,
    show: false,
    backgroundColor: THEME_SURFACE[store.data.settings.theme] || THEME_SURFACE.colore,
    title: type === 'todo' ? 'To-do' : 'Emploi du temps',
    webPreferences: baseWebPreferences(),
  });
  win.setOpacity(store.data.settings.widgets.opacity);
  win.loadFile(path.join(RENDERER, 'widget.html'), { query: { type } });
  win.once('ready-to-show', () => win.showInactive());

  let saveTimer = null;
  const saveBounds = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      store.setSettings({ widgets: { [type]: { bounds: win.getBounds() } } });
    }, 400);
  };
  win.on('moved', saveBounds);
  win.on('resized', saveBounds);
  // Après être passé au premier plan, le widget redevient un élément du bureau
  win.on('blur', () => {
    if (!win.isDestroyed()) win.setAlwaysOnTop(false);
  });
  win.on('closed', () => {
    widgetWins[type] = null;
  });
  widgetWins[type] = win;
  return win;
}

function syncWidgets() {
  const w = store.data.settings.widgets;
  for (const type of ['todo', 'edt']) {
    const win = widgetWins[type];
    if (w[type].visible) {
      const created = createWidget(type);
      created.setOpacity(w.opacity);
    } else if (win && !win.isDestroyed()) {
      win.destroy();
    }
  }
}

function widgetsToFront() {
  const visible = Object.values(widgetWins).filter((w) => w && !w.isDestroyed());
  if (!visible.length) {
    showMain('reglages');
    return;
  }
  for (const w of visible) {
    w.setAlwaysOnTop(true, 'floating');
    w.show();
  }
  visible[0].focus();
}

// ---------- Pop-up de rappel ----------

function popupBounds() {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = 400;
  const height = 230;
  return { x: area.x + area.width - width - 16, y: area.y + area.height - height - 16, width, height };
}

function showNextPopup() {
  if (popupCurrent || !popupQueue.length) return;
  popupCurrent = popupQueue.shift();
  if (!popupWin || popupWin.isDestroyed()) {
    popupWin = new BrowserWindow({
      ...popupBounds(),
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      focusable: true,
      transparent: true,
      hasShadow: false,
      webPreferences: baseWebPreferences(),
    });
    popupWin.loadFile(path.join(RENDERER, 'popup.html'));
    popupWin.on('closed', () => {
      popupWin = null;
      popupCurrent = null;
    });
    popupWin.webContents.once('did-finish-load', () => presentPopup());
  } else {
    popupWin.setBounds(popupBounds());
    presentPopup();
  }
}

function presentPopup() {
  if (!popupWin || !popupCurrent) return;
  popupWin.webContents.send('popup', popupCurrent);
  // Niveau le plus haut : passe devant les autres fenêtres, même en plein écran
  popupWin.setAlwaysOnTop(true, 'screen-saver');
  popupWin.setVisibleOnAllWorkspaces(true);
  popupWin.show();
  popupWin.focus();
  popupWin.moveTop();
}

function notify(payload) {
  popupQueue.push({ ...payload, notifId: id() });
  showNextPopup();
}

function handlePopupAction(action) {
  const p = popupCurrent;
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
  if (action === 'open') showMain(p.kind === 'task' ? 'todo' : 'agenda');
  popupCurrent = null;
  if (popupQueue.length) showNextPopup();
  else if (popupWin && !popupWin.isDestroyed()) popupWin.hide();
}

// ---------- Saisie rapide ----------

function showQuickAdd() {
  if (!quickAddWin || quickAddWin.isDestroyed()) {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const width = 560;
    quickAddWin = new BrowserWindow({
      x: Math.round(area.x + (area.width - width) / 2),
      y: area.y + Math.round(area.height * 0.2),
      width,
      height: 150,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      transparent: true,
      show: false,
      hasShadow: false,
      webPreferences: baseWebPreferences(),
    });
    quickAddWin.loadFile(path.join(RENDERER, 'quickadd.html'));
    quickAddWin.on('blur', () => quickAddWin && !quickAddWin.isDestroyed() && quickAddWin.hide());
    quickAddWin.once('ready-to-show', () => {
      quickAddWin.show();
      quickAddWin.focus();
    });
  } else {
    quickAddWin.show();
    quickAddWin.focus();
    quickAddWin.webContents.send('quickadd:reset');
  }
}

// ---------- Raccourcis clavier globaux ----------

function registerShortcuts() {
  globalShortcut.unregisterAll();
  const s = store.data.settings.shortcuts;
  const actions = { quickAdd: showQuickAdd, widgetsFront: widgetsToFront, showMain: () => showMain() };
  const errors = [];
  for (const [name, fn] of Object.entries(actions)) {
    const accel = (s[name] || '').trim();
    if (!accel) continue;
    try {
      if (!globalShortcut.register(accel, fn)) errors.push(`${accel} (déjà utilisé par une autre application)`);
    } catch {
      errors.push(`${accel} (raccourci invalide)`);
    }
  }
  return errors;
}

// ---------- Lancement au démarrage ----------

function applyAutoLaunch() {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: store.data.settings.autoLaunch, args: ['--au-demarrage'] });
}

// ---------- Zone de notification ----------

function setDnd(minutes) {
  const until = minutes > 0 ? Date.now() + minutes * 60000 : 0;
  store.setSettings({ dndUntil: until });
  broadcastState();
}

function untilTomorrowMinutes() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(7, 0, 0, 0);
  return Math.ceil((t - Date.now()) / 60000);
}

function toggleWidget(type, visible) {
  store.setSettings({ widgets: { [type]: { visible } } });
  syncWidgets();
  broadcastState();
}

function refreshTrayMenu() {
  if (!tray) return;
  const s = store.data.settings;
  const dnd = s.dndUntil > Date.now();
  const menu = Menu.buildFromTemplate([
    { label: 'Ouvrir Mon Planning', click: () => showMain() },
    { label: 'Ajouter une tâche…', click: showQuickAdd },
    { type: 'separator' },
    { label: 'Widget to-do', type: 'checkbox', checked: s.widgets.todo.visible, click: (i) => toggleWidget('todo', i.checked) },
    { label: 'Widget emploi du temps', type: 'checkbox', checked: s.widgets.edt.visible, click: (i) => toggleWidget('edt', i.checked) },
    { label: 'Widgets au premier plan', click: widgetsToFront },
    { type: 'separator' },
    {
      label: dnd ? `Ne pas déranger (jusqu'à ${new Date(s.dndUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : 'Ne pas déranger',
      submenu: [
        { label: '30 minutes', click: () => setDnd(30) },
        { label: '1 heure', click: () => setDnd(60) },
        { label: '2 heures', click: () => setDnd(120) },
        { label: "Jusqu'à demain matin", click: () => setDnd(untilTomorrowMinutes()) },
        { label: 'Désactiver', enabled: dnd, click: () => setDnd(0) },
      ],
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(dnd ? 'Mon Planning — ne pas déranger' : 'Mon Planning');
}

function createTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.on('click', () => showMain());
  refreshTrayMenu();
}

// ---------- Agendas externes ----------

async function refreshFeed(feed) {
  const events = await ics.fetchFeed(feed);
  store.data.importedEvents = store.data.importedEvents.filter((e) => e.feedId !== feed.id).concat(events);
  store.save();
  return events.length;
}

async function refreshAllFeeds() {
  const errors = [];
  for (const feed of store.data.settings.icsFeeds) {
    if (!feed.url) continue;
    try {
      await refreshFeed(feed);
    } catch (err) {
      errors.push(`${feed.name} : ${err.message}`);
    }
  }
  broadcastState();
  return errors;
}

// ---------- IPC ----------

const SOUND_MIME = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };

function registerIpc() {
  ipcMain.handle('state:get', () => store.data);

  ipcMain.handle('data:upsert', (_e, collection, item) => {
    store.upsert(collection, item);
    broadcastState();
  });
  ipcMain.handle('data:remove', (_e, collection, itemId) => {
    store.remove(collection, itemId);
    if (collection === 'categories') {
      for (const t of store.data.tasks) t.categories = (t.categories || []).filter((c) => c !== itemId);
    }
    broadcastState();
  });
  ipcMain.handle('data:setLog', (_e, key, value) => {
    store.setLog(key, value);
    broadcastState();
  });

  ipcMain.handle('settings:set', (_e, partial) => {
    store.setSettings(partial);
    let shortcutErrors = [];
    if ('autoLaunch' in partial) applyAutoLaunch();
    if (partial.shortcuts) shortcutErrors = registerShortcuts();
    if (partial.widgets) syncWidgets();
    if (partial.pomodoro && !pomodoro.running) pomodoro.reset();
    broadcastState();
    return { shortcutErrors };
  });

  ipcMain.handle('dnd:set', (_e, minutes) => setDnd(minutes === 'tomorrow' ? untilTomorrowMinutes() : minutes));

  ipcMain.handle('pomodoro:get', () => pomodoro.state());
  ipcMain.handle('pomodoro:action', (_e, action, arg) => {
    if (action === 'start') pomodoro.start(arg);
    if (action === 'pause') pomodoro.pause();
    if (action === 'reset') pomodoro.reset();
    if (action === 'skip') pomodoro.skip();
    return pomodoro.state();
  });

  ipcMain.on('popup:action', (_e, action) => handlePopupAction(action));
  ipcMain.handle('popup:test', () => {
    notify({ kind: 'activity', phase: 'test', title: 'Test de notification', color: '#7c5cff', start: Date.now() });
  });

  ipcMain.on('quickadd:close', () => quickAddWin && !quickAddWin.isDestroyed() && quickAddWin.hide());
  ipcMain.on('widget:close', (_e, type) => toggleWidget(type, false));
  ipcMain.on('main:show', (_e, view) => showMain(view));

  ipcMain.handle('ics:addFeed', async (_e, feed) => {
    const full = { id: id(), name: feed.name || 'Agenda', color: feed.color || '#8a8f98', url: feed.url.trim() };
    const count = await refreshFeed(full);
    store.setSettings({ icsFeeds: [...store.data.settings.icsFeeds, full] });
    broadcastState();
    return count;
  });
  ipcMain.handle('ics:refresh', () => refreshAllFeeds());
  ipcMain.handle('ics:removeFeed', (_e, feedId) => {
    store.data.importedEvents = store.data.importedEvents.filter((e) => e.feedId !== feedId);
    store.setSettings({ icsFeeds: store.data.settings.icsFeeds.filter((f) => f.id !== feedId) });
    broadcastState();
  });
  ipcMain.handle('ics:importFile', async (_e, color) => {
    const res = await dialog.showOpenDialog(mainWin, {
      title: 'Importer un agenda',
      filters: [{ name: 'Agenda iCalendar', extensions: ['ics'] }],
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const file = res.filePaths[0];
    const feed = { id: id(), name: path.basename(file, '.ics'), color: color || '#8a8f98', url: '' };
    const events = ics.parseFile(fs.readFileSync(file, 'utf8'), feed);
    store.data.importedEvents.push(...events);
    store.setSettings({ icsFeeds: [...store.data.settings.icsFeeds, feed] });
    broadcastState();
    return events.length;
  });

  ipcMain.handle('data:export', async () => {
    const res = await dialog.showSaveDialog(mainWin, {
      title: 'Exporter mes données',
      defaultPath: `mon-planning-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, JSON.stringify(store.data, null, 2));
    return true;
  });
  ipcMain.handle('data:import', async () => {
    const res = await dialog.showOpenDialog(mainWin, {
      title: 'Importer une sauvegarde',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return false;
    const raw = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
    if (!Array.isArray(raw.tasks) || !Array.isArray(raw.activities)) throw new Error("Ce fichier n'est pas une sauvegarde de Mon Planning.");
    store.saveNow();
    fs.mkdirSync(store.backupDir, { recursive: true });
    fs.copyFileSync(store.file, path.join(store.backupDir, `avant-restauration-${Date.now()}.json`));
    store.replaceAll(raw);
    applyAutoLaunch();
    registerShortcuts();
    syncWidgets();
    broadcastState();
    return true;
  });
  ipcMain.handle('data:openBackups', () => {
    fs.mkdirSync(store.backupDir, { recursive: true });
    return shell.openPath(store.backupDir);
  });

  ipcMain.handle('sound:choose', async () => {
    const res = await dialog.showOpenDialog(mainWin, {
      title: 'Choisir un son',
      filters: [{ name: 'Sons', extensions: Object.keys(SOUND_MIME).map((e) => e.slice(1)) }],
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const src = res.filePaths[0];
    const dir = path.join(app.getPath('userData'), 'sons');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `perso${path.extname(src).toLowerCase()}`);
    fs.copyFileSync(src, target);
    store.setSettings({ customSoundPath: target, sound: 'custom' });
    broadcastState();
    return path.basename(src);
  });
  ipcMain.handle('sound:read', () => {
    const file = store.data.settings.customSoundPath;
    if (!file || !fs.existsSync(file)) return null;
    const mime = SOUND_MIME[path.extname(file).toLowerCase()] || 'audio/mpeg';
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
    dataDir: app.getPath('userData'),
  }));
}

// ---------- Démarrage ----------

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));
  registerIpc();

  pomodoro = new Pomodoro(
    () => store.data.settings.pomodoro,
    (state) => broadcast('pomodoro', state),
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

  const launchedAtLogin = process.argv.includes('--au-demarrage');
  createMainWindow(!(launchedAtLogin && store.data.settings.startHidden));
  // Une étape qui échoue ne doit pas empêcher les autres de démarrer
  for (const step of [createTray, registerShortcuts, applyAutoLaunch, syncWidgets]) {
    try {
      step();
    } catch (err) {
      console.error(`Échec au démarrage (${step.name}) :`, err);
    }
  }

  refreshAllFeeds();
  setInterval(refreshAllFeeds, ICS_REFRESH_MS);
  // Met à jour l'affichage du « ne pas déranger » quand il expire
  setInterval(refreshTrayMenu, 60 * 1000);
});

app.on('second-instance', () => showMain());

app.on('before-quit', () => {
  quitting = true;
  if (store) store.saveNow();
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// L'appli continue de tourner dans la zone de notification
app.on('window-all-closed', () => {});
