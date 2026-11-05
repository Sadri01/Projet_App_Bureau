// Pont sécurisé entre l'interface et le processus principal.
const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, cb) {
  const listener = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (cb) => subscribe('state', cb),
  onNavigate: (cb) => subscribe('navigate', cb),

  upsert: (collection, item) => ipcRenderer.invoke('data:upsert', collection, item),
  remove: (collection, id) => ipcRenderer.invoke('data:remove', collection, id),
  setLog: (key, value) => ipcRenderer.invoke('data:setLog', key, value),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  setDnd: (minutes) => ipcRenderer.invoke('dnd:set', minutes),

  pomodoroState: () => ipcRenderer.invoke('pomodoro:get'),
  pomodoro: (action, arg) => ipcRenderer.invoke('pomodoro:action', action, arg),
  onPomodoro: (cb) => subscribe('pomodoro', cb),

  onPopup: (cb) => subscribe('popup', cb),
  popupAction: (action) => ipcRenderer.send('popup:action', action),
  testPopup: () => ipcRenderer.invoke('popup:test'),

  onQuickAddReset: (cb) => subscribe('quickadd:reset', cb),
  closeQuickAdd: () => ipcRenderer.send('quickadd:close'),
  closeWidget: (type) => ipcRenderer.send('widget:close', type),
  showMain: (view) => ipcRenderer.send('main:show', view),

  addFeed: (feed) => ipcRenderer.invoke('ics:addFeed', feed),
  refreshFeeds: () => ipcRenderer.invoke('ics:refresh'),
  removeFeed: (id) => ipcRenderer.invoke('ics:removeFeed', id),
  importIcsFile: (color) => ipcRenderer.invoke('ics:importFile', color),

  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  openBackups: () => ipcRenderer.invoke('data:openBackups'),

  chooseSound: () => ipcRenderer.invoke('sound:choose'),
  readSound: () => ipcRenderer.invoke('sound:read'),

  appInfo: () => ipcRenderer.invoke('app:info'),

  syncPayload: (options) => ipcRenderer.invoke('sync:payload', options),
  syncMerge: (incoming) => ipcRenderer.invoke('sync:merge', incoming),

  updateStatus: () => ipcRenderer.invoke('update:status'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb) => subscribe('update-status', cb),

  listBoards: () => ipcRenderer.invoke('boards:list'),
  getBoard: (id) => ipcRenderer.invoke('boards:get', id),
  saveBoard: (board) => ipcRenderer.invoke('boards:save', board),
  deleteBoard: (id) => ipcRenderer.invoke('boards:delete', id),
  copyBoardImage: (dataUrl) => ipcRenderer.invoke('boards:copyImage', dataUrl),
  saveBoardImage: (dataUrl, name) => ipcRenderer.invoke('boards:saveImage', dataUrl, name),
});
