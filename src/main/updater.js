// Mises à jour automatiques depuis les « Releases » GitHub du projet.
const { app } = require('electron');

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 15 * 1000;

class Updater {
  // onStatus(status) : informe l'interface ; onReady(version) : mise à jour prête à installer
  constructor(onStatus, onReady) {
    this.onStatus = onStatus;
    this.onReady = onReady;
    this.status = { state: 'idle', version: app.getVersion() };
    this.updater = null;
  }

  start() {
    // En développement (npm start), il n'y a rien à mettre à jour
    if (!app.isPackaged) {
      this.set({ state: 'dev' });
      return;
    }
    const { autoUpdater } = require('electron-updater');
    this.updater = autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = console;

    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }));
    autoUpdater.on('update-not-available', () => this.set({ state: 'uptodate', checkedAt: Date.now() }));
    autoUpdater.on('update-available', (info) => this.set({ state: 'downloading', newVersion: info.version, percent: 0 }));
    autoUpdater.on('download-progress', (p) => this.set({ state: 'downloading', percent: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (info) => {
      this.set({ state: 'ready', newVersion: info.version });
      this.onReady(info.version);
    });
    autoUpdater.on('error', (err) => this.set({ state: 'error', message: friendlyError(err) }));

    setTimeout(() => this.check(), FIRST_CHECK_DELAY_MS);
    setInterval(() => this.check(), CHECK_EVERY_MS);
  }

  set(partial) {
    this.status = { ...this.status, ...partial };
    this.onStatus(this.status);
  }

  async check() {
    if (!this.updater) return this.status;
    // Une mise à jour déjà téléchargée attend simplement le redémarrage
    if (['checking', 'downloading', 'ready'].includes(this.status.state)) return this.status;
    try {
      await this.updater.checkForUpdates();
    } catch (err) {
      this.set({ state: 'error', message: friendlyError(err) });
    }
    return this.status;
  }

  install() {
    if (this.status.state !== 'ready') return;
    // Installation silencieuse puis relance automatique de l'appli
    this.updater.quitAndInstall(true, true);
  }
}

function friendlyError(err) {
  const msg = String(err?.message || err);
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|net::/i.test(msg)) return 'Pas de connexion Internet';
  if (/404|latest\.yml/i.test(msg)) return 'Aucune version publiée pour le moment';
  return msg.split('\n')[0].slice(0, 160);
}

module.exports = { Updater };
