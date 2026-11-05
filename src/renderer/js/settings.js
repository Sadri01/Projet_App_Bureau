// Vue « Réglages ».
const Settings = (() => {
  let root;
  let info = null;

  const THEMES = [
    { id: 'colore', name: 'Minimaliste coloré', colors: ['#f4f5fb', '#6c4ff6', '#ff5c8a', '#ffffff'] },
    { id: 'sombre', name: 'Sombre', colors: ['#101216', '#8f7dff', '#4fd1c5', '#272c35'] },
    { id: 'survie', name: 'Survie (post-apo)', colors: ['#171a14', '#c8642c', '#8aa857', '#e9dfc6'] },
  ];

  const SHORTCUTS = [
    ['quickAdd', 'Ajouter une tâche depuis n’importe où'],
    ['widgetsFront', 'Passer les widgets au premier plan'],
    ['showMain', 'Ouvrir la fenêtre principale'],
  ];

  let update = null;

  function init() {
    root = U.$('#view-reglages');
    api.onUpdateStatus((st) => {
      update = st;
      renderUpdate();
    });
  }

  function renderUpdate() {
    const el = U.$('[data-update-status]', root);
    if (!el || !update) return;
    const texts = {
      dev: 'Mode développement (npm start) : les mises à jour ne concernent que la version installée.',
      web: '',
      idle: '',
      checking: 'Recherche en cours…',
      uptodate: `Tu as la dernière version${update.checkedAt ? ` (vérifié à ${U.fmtTime(update.checkedAt)})` : ''}.`,
      downloading: `Téléchargement de la version ${update.newVersion || ''}… ${update.percent || 0} %`,
      ready: `La version ${update.newVersion} est prête.`,
      error: `Impossible de vérifier : ${update.message || 'erreur inconnue'}`,
    };
    el.textContent = texts[update.state] ?? '';
    el.style.color = update.state === 'error' ? 'var(--danger)' : update.state === 'ready' ? 'var(--success)' : '';
    U.$('[data-install-update]', root).hidden = update.state !== 'ready';
    U.$('[data-check-update]', root).disabled = ['checking', 'downloading', 'dev'].includes(update.state);
  }

  const checked = (v) => (v ? 'checked' : '');

  async function render(state) {
    if (!root || App.view !== 'reglages') return;
    info = info || (await api.appInfo());
    const s = state.settings;
    const dnd = s.dndUntil > Date.now();

    root.innerHTML = `
      <header class="view-header"><h1>Réglages</h1></header>
      <div class="view-body">
        <div class="settings">

          <section class="card">
            <h2>Thème</h2>
            <div class="theme-cards">
              ${THEMES.map(
                (t) => `<button class="theme-card ${s.theme === t.id ? 'selected' : ''}" data-theme-id="${t.id}">
                  <div class="preview" style="background:${t.colors[0]}">
                    ${t.colors.slice(1).map((c, i) => `<span style="background:${c};height:${[60, 38, 24][i]}%"></span>`).join('')}
                  </div>
                  <div class="name">${t.name}</div>
                </button>`,
              ).join('')}
            </div>
          </section>

          <section class="card" data-web-only>
            <h2>Sur ce téléphone</h2>
            <button class="btn primary" data-install-app hidden style="align-self:flex-start">📲 Installer l’appli sur l’écran d’accueil</button>
            <p class="small muted" data-install-help>Pour l’installer : menu ⋮ de Chrome → « Ajouter à l’écran d’accueil » (ou « Installer l’application »).</p>
            <div class="row wrap">
              <button class="btn" data-allow-notif>🔔 Autoriser les notifications</button>
              <span class="small muted" data-notif-status></span>
            </div>
            <p class="small muted">Les rappels arrivent tant que l’appli est ouverte ou en arrière-plan récent. Android peut la mettre en veille au bout d’un moment : pour les rappels importants, c’est le PC qui fait foi.</p>
          </section>

          <section class="card">
            <h2>Synchronisation PC ↔ téléphone</h2>
            <p class="small muted">1. Sur un appareil, copie ton code. 2. Envoie-le-toi (WhatsApp, mail…). 3. Sur l’autre appareil, colle-le ici puis « Fusionner ».
              Rien n’est écrasé : pour chaque élément, la modification la plus récente gagne. Fais-le dans les deux sens pour que les deux appareils soient identiques.</p>
            <label class="switch"><input type="checkbox" data-sync-boards checked>Inclure les feuilles de brainstorming (code plus long)</label>
            <div class="row wrap">
              <button class="btn primary" data-sync-copy>📋 Copier mon code</button>
              <button class="btn" data-sync-share data-web-only>↗ Partager</button>
              <button class="btn" data-sync-file>💾 En fichier</button>
            </div>
            <p class="small muted" data-sync-info></p>
            <textarea class="input" data-sync-input rows="3" placeholder="Colle ici le code de l’autre appareil (il commence par MP1.)"></textarea>
            <div class="row wrap">
              <button class="btn primary" data-sync-merge>⇄ Fusionner</button>
              <button class="btn" data-sync-paste>Coller</button>
              <button class="btn" data-sync-open>📂 Ouvrir un fichier</button>
            </div>
          </section>

          <section class="card" data-desktop-only>
            <h2>Démarrage</h2>
            <label class="switch"><input type="checkbox" data-set="autoLaunch" ${checked(s.autoLaunch)}>Lancer Mon Planning au démarrage de Windows</label>
            <label class="switch"><input type="checkbox" data-set="startHidden" ${checked(s.startHidden)}>Au démarrage, rester discret dans la zone de notification</label>
            ${info.packaged ? '' : '<p class="small muted">Le lancement au démarrage ne s’active que dans la version installée (pas avec « npm start »).</p>'}
            <p class="small muted">Fermer la fenêtre ne quitte pas l’application : elle reste près de l’horloge pour t’envoyer les rappels. Pour la quitter : clic droit sur son icône → Quitter.</p>
          </section>

          <section class="card">
            <h2>Notifications</h2>
            <label class="field">Son
              <div class="row">
                <select class="input grow" data-set="sound">
                  ${Object.entries(Sounds.LIST).map(([k, l]) => `<option value="${k}" ${s.sound === k ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
                <button class="btn" data-choose-sound data-desktop-only title="Choisir un fichier MP3, WAV ou OGG">📁 Fichier…</button>
                <button class="btn" data-test-sound>▶ Écouter</button>
              </div>
            </label>
            <label class="field">Volume
              <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume">
            </label>
            <label class="field">Rappel avant une activité (par défaut)
              <select class="input" data-set="reminderDefault">
                ${[0, 5, 10, 15, 30, 60].map((m) => `<option value="${m}" ${Number(s.reminderDefault) === m ? 'selected' : ''}>${m ? `${m} min avant` : 'Pas de rappel avant'}</option>`).join('')}
              </select>
            </label>
            <label class="switch"><input type="checkbox" data-set="notifyTasks" ${checked(s.notifyTasks)}>Me prévenir à l’échéance des tâches</label>
            <label class="switch"><input type="checkbox" data-set="notifyImported" ${checked(s.notifyImported)}>Me prévenir pour les événements des agendas importés</label>
            <label class="switch"><input type="checkbox" data-set="pomodoroOnGo" ${checked(s.pomodoroOnGo)}>Lancer un Pomodoro quand je clique sur « J’y vais »</label>
            <div class="field">Ne pas déranger ${dnd ? `<span class="chip" style="align-self:flex-start">actif jusqu’à ${U.fmtTime(s.dndUntil)}</span>` : ''}
              <div class="row wrap">
                <button class="btn small" data-dnd="30">30 min</button>
                <button class="btn small" data-dnd="60">1 h</button>
                <button class="btn small" data-dnd="120">2 h</button>
                <button class="btn small" data-dnd="tomorrow">Jusqu’à demain 7 h</button>
                ${dnd ? '<button class="btn small" data-dnd="0">Désactiver</button>' : ''}
              </div>
            </div>
            <button class="btn" data-test-popup style="align-self:flex-start">Tester le pop-up</button>
          </section>

          <section class="card" data-desktop-only>
            <h2>Widgets de bureau</h2>
            <label class="switch"><input type="checkbox" data-widget="todo" ${checked(s.widgets.todo.visible)}>Afficher la to-do list sur le bureau</label>
            <label class="switch"><input type="checkbox" data-widget="edt" ${checked(s.widgets.edt.visible)}>Afficher l’emploi du temps du jour sur le bureau</label>
            <label class="field">Opacité
              <input type="range" min="0.4" max="1" step="0.02" value="${s.widgets.opacity}" data-widget-opacity>
            </label>
            <p class="small muted">Déplace un widget en le tenant par son titre, redimensionne-le par les bords. Il reste sur le bureau, derrière tes fenêtres ;
              appuie sur <kbd>${U.esc(s.shortcuts.widgetsFront || '—')}</kbd> pour le faire passer au premier plan. Il repasse derrière dès que tu cliques ailleurs.</p>
          </section>

          <section class="card" data-desktop-only>
            <h2>Raccourcis clavier</h2>
            ${SHORTCUTS.map(
              ([k, l]) => `<label class="field">${l}
                <input class="input" data-shortcut="${k}" value="${U.esc(s.shortcuts[k] || '')}" placeholder="Clique puis appuie sur les touches">
              </label>`,
            ).join('')}
            <p class="small muted">Clique dans une case puis appuie sur la combinaison voulue (ex. Ctrl+Alt+T). Retour arrière pour effacer.</p>
          </section>

          <section class="card">
            <h2>Emploi du temps</h2>
            <div class="row">
              <label class="field grow">Afficher à partir de
                <select class="input" data-set="dayStart">${hourOptions(0, 23, s.dayStart)}</select>
              </label>
              <label class="field grow">jusqu’à
                <select class="input" data-set="dayEnd">${hourOptions(1, 24, s.dayEnd)}</select>
              </label>
            </div>
          </section>

          <section class="card">
            <h2>Agendas externes</h2>
            <p class="small muted" data-web-only>Les agendas se gèrent sur le PC ; leurs événements arrivent ici avec la synchronisation.</p>
            <p class="small muted" style="margin:0" data-desktop-only>Google Agenda : Paramètres de l’agenda → « Adresse secrète au format iCal ». Colle ce lien ici.
              Outlook : Paramètres → Calendrier → Calendriers partagés → Publier → lien ICS.</p>
            <div>${s.icsFeeds.length ? s.icsFeeds.map((f) => `<div class="feed"><span class="dot" style="background:${f.color}"></span><span class="grow">${U.esc(f.name)}</span><span class="small muted">${f.url ? 'lien' : 'fichier'}</span><button class="btn small ghost danger" data-remove-feed="${f.id}" data-desktop-only>Retirer</button></div>`).join('') : '<span class="muted small">Aucun agenda importé.</span>'}</div>
            <form class="row wrap" data-add-feed data-desktop-only>
              <input class="input" name="name" placeholder="Nom" style="width:120px" required>
              <input class="input grow" name="url" placeholder="https://… .ics" required>
              <input type="color" class="swatch-custom" name="color" value="#8a8f98" title="Couleur">
              <button class="btn primary" type="submit">Ajouter</button>
            </form>
            <div class="row" data-desktop-only>
              <button class="btn" data-import-ics>📁 Importer un fichier .ics</button>
              <button class="btn" data-refresh-ics>↻ Actualiser</button>
            </div>
          </section>

          <section class="card">
            <h2>Sauvegarde</h2>
            <p class="small muted" style="margin:0" data-desktop-only>Une copie de tes données est faite automatiquement chaque jour (10 dernières conservées).</p>
            <div class="row wrap">
              <button class="btn" data-export>⬇ Exporter mes données</button>
              <button class="btn" data-import>⬆ Restaurer une sauvegarde</button>
              <button class="btn ghost" data-open-backups data-desktop-only>Ouvrir le dossier des sauvegardes</button>
            </div>
          </section>

          <section class="card">
            <h2>Mises à jour</h2>
            <p class="small muted">Version installée : <b>${U.esc(info.version)}</b>.
              ${
                info.web
                  ? "L'appli vérifie toute seule s'il existe une nouvelle version à chaque ouverture et te propose de recharger."
                  : "L'appli vérifie toute seule au démarrage puis toutes les 4 heures, télécharge les nouvelles versions en arrière-plan et les installe quand tu la quittes."
              }</p>
            <div class="row wrap">
              <button class="btn" data-check-update>↻ Rechercher une mise à jour</button>
              <button class="btn primary" data-install-update hidden>${info.web ? 'Recharger' : 'Redémarrer et mettre à jour'}</button>
            </div>
            <p class="small" data-update-status></p>
          </section>
        </div>
      </div>`;

    bind();
  }

  function hourOptions(min, max, selected) {
    let out = '';
    for (let h = min; h <= max; h++) out += `<option value="${h}" ${Number(selected) === h ? 'selected' : ''}>${Schedule.pad(h)}:00</option>`;
    return out;
  }

  // Convertit une touche du clavier en raccourci Electron (Control+Alt+T)
  function accelerator(e) {
    const ignore = ['Control', 'Shift', 'Alt', 'Meta'];
    if (ignore.includes(e.key)) return null;
    const parts = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');
    if (!parts.length || (parts.length === 1 && parts[0] === 'Shift')) return null;
    let key = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();
    return [...parts, key].join('+');
  }

  async function set(partial) {
    const res = await api.setSettings(partial);
    if (res?.shortcutErrors?.length) U.toast(`Raccourci indisponible : ${res.shortcutErrors.join(', ')}`, 'error');
  }

  function bind() {
    U.$$('[data-theme-id]', root).forEach((b) => (b.onclick = () => set({ theme: b.dataset.themeId })));

    U.$$('[data-set]', root).forEach((input) => {
      const key = input.dataset.set;
      input.addEventListener('change', () => {
        let value = input.type === 'checkbox' ? input.checked : input.value;
        if (['volume', 'reminderDefault', 'dayStart', 'dayEnd'].includes(key)) value = Number(value);
        if (key === 'dayEnd' && value <= App.state.settings.dayStart) value = App.state.settings.dayStart + 1;
        if (key === 'dayStart' && value >= App.state.settings.dayEnd) {
          set({ dayStart: value, dayEnd: Math.min(24, value + 1) });
          return;
        }
        set({ [key]: value });
      });
    });

    U.$('[data-test-sound]', root).onclick = () => Sounds.play(App.state.settings, api.readSound);
    U.$('[data-choose-sound]', root).onclick = async () => {
      const name = await api.chooseSound();
      if (name) U.toast(`Son « ${name} » enregistré`);
    };
    U.$('[data-test-popup]', root).onclick = () => api.testPopup();
    U.$$('[data-dnd]', root).forEach((b) => (b.onclick = () => api.setDnd(b.dataset.dnd === 'tomorrow' ? 'tomorrow' : Number(b.dataset.dnd))));

    U.$$('[data-widget]', root).forEach((cb) => cb.addEventListener('change', () => set({ widgets: { [cb.dataset.widget]: { visible: cb.checked } } })));
    U.$('[data-widget-opacity]', root).addEventListener('change', (e) => set({ widgets: { opacity: Number(e.target.value) } }));

    U.$$('[data-shortcut]', root).forEach((input) =>
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') return;
        e.preventDefault();
        if (e.key === 'Backspace' || e.key === 'Delete') {
          input.value = '';
          set({ shortcuts: { [input.dataset.shortcut]: '' } });
          return;
        }
        const acc = accelerator(e);
        if (!acc) return;
        input.value = acc;
        set({ shortcuts: { [input.dataset.shortcut]: acc } });
      }),
    );

    U.$('[data-add-feed]', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const btn = U.$('button[type="submit"]', f);
      btn.disabled = true;
      btn.textContent = 'Chargement…';
      try {
        const n = await api.addFeed({ name: f.name.value.trim(), url: f.url.value.trim(), color: f.color.value });
        U.toast(`${n} événement(s) importé(s)`);
      } catch (err) {
        U.toast(`Impossible de charger cet agenda : ${cleanError(err)}`, 'error');
        btn.disabled = false;
        btn.textContent = 'Ajouter';
      }
    });
    U.$('[data-import-ics]', root).onclick = async () => {
      try {
        const n = await api.importIcsFile('#8a8f98');
        if (n !== null) U.toast(`${n} événement(s) importé(s)`);
      } catch (err) {
        U.toast(`Fichier illisible : ${cleanError(err)}`, 'error');
      }
    };
    U.$('[data-refresh-ics]', root).onclick = async () => {
      const errors = await api.refreshFeeds();
      U.toast(errors.length ? errors.join(' · ') : 'Agendas à jour', errors.length ? 'error' : '');
    };
    U.$$('[data-remove-feed]', root).forEach((b) => (b.onclick = () => api.removeFeed(b.dataset.removeFeed)));

    U.$('[data-export]', root).onclick = async () => {
      if (await api.exportData()) U.toast('Données exportées');
    };
    U.$('[data-import]', root).onclick = async () => {
      if (!(await Modal.confirm('Restaurer une sauvegarde', 'Tes données actuelles seront remplacées (une copie de sécurité est faite avant).', 'Continuer'))) return;
      try {
        if (await api.importData()) U.toast('Sauvegarde restaurée');
      } catch (err) {
        U.toast(cleanError(err), 'error');
      }
    };
    U.$('[data-open-backups]', root).onclick = () => api.openBackups();

    U.$('[data-check-update]', root).onclick = async () => {
      update = await api.checkUpdate();
      renderUpdate();
    };
    U.$('[data-install-update]', root).onclick = () => api.installUpdate();

    bindSync();
    if (info.web) bindPhone();
    api.updateStatus().then((st) => {
      update = st;
      renderUpdate();
    });
  }

  // ---------- Synchronisation par code ----------

  const syncName = () => `mon-planning-synchro-${new Date().toISOString().slice(0, 10)}.mpsync`;

  async function makeCode() {
    const includeBoards = U.$('[data-sync-boards]', root).checked;
    return Sync.encode(await api.syncPayload({ includeBoards }));
  }

  function syncInfo(text) {
    U.$('[data-sync-info]', root).textContent = text;
  }

  const sizeLabel = (code) => (code.length > 1000 ? `${Math.round(code.length / 1000)} 000 caractères` : `${code.length} caractères`);

  async function merge(code) {
    if (!code.trim()) return U.toast('Colle d’abord le code de l’autre appareil.', 'error');
    try {
      const incoming = await Sync.decode(code);
      const message = await api.syncMerge(incoming);
      U.toast(`Synchronisé : ${message}`);
    } catch (err) {
      U.toast(cleanError(err), 'error');
    }
  }

  function bindSync() {
    U.$('[data-sync-copy]', root).onclick = async () => {
      const code = await makeCode();
      try {
        await navigator.clipboard.writeText(code);
        syncInfo(`Code copié (${sizeLabel(code)}). Colle-le dans un message pour toi-même, puis sur l’autre appareil.`);
        U.toast('Code copié');
      } catch {
        // Presse-papiers refusé : on affiche le code pour une copie à la main
        U.$('[data-sync-input]', root).value = code;
        syncInfo('Copie automatique impossible : sélectionne le code ci-dessous et copie-le.');
      }
      if (code.length > 60000) syncInfo(`Code très long (${sizeLabel(code)}) : certaines messageries le coupent. Utilise plutôt « En fichier », ou décoche le brainstorming.`);
    };
    U.$('[data-sync-share]', root).onclick = async () => {
      const code = await makeCode();
      if (!(await api.shareText(code, 'Code Mon Planning'))) U.toast('Partage impossible : utilise « Copier mon code ».', 'error');
    };
    U.$('[data-sync-file]', root).onclick = async () => {
      const blob = new Blob([await makeCode()], { type: 'text/plain' });
      if (info.web) return api.shareFile(blob, syncName());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = syncName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    };
    U.$('[data-sync-paste]', root).onclick = async () => {
      try {
        U.$('[data-sync-input]', root).value = await navigator.clipboard.readText();
      } catch {
        U.toast('Lecture du presse-papiers refusée : appuie longuement dans la case puis « Coller ».', 'error');
      }
    };
    U.$('[data-sync-merge]', root).onclick = () => merge(U.$('[data-sync-input]', root).value);
    U.$('[data-sync-open]', root).onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.mpsync,.txt,text/plain';
      input.onchange = async () => input.files[0] && merge(await input.files[0].text());
      input.click();
    };
  }

  // ---------- Téléphone : installation et notifications ----------

  function bindPhone() {
    const installBtn = U.$('[data-install-app]', root);
    const refreshInstall = () => {
      installBtn.hidden = !api.canInstall();
      U.$('[data-install-help]', root).hidden = api.canInstall() || matchMedia('(display-mode: standalone)').matches;
    };
    refreshInstall();
    api.onInstallAvailable(refreshInstall);
    installBtn.onclick = async () => {
      if (await api.install()) U.toast('Appli installée sur l’écran d’accueil');
      refreshInstall();
    };
    const status = U.$('[data-notif-status]', root);
    const labels = { granted: 'autorisées ✓', denied: 'bloquées (à changer dans les réglages Android de Chrome)', default: '', unsupported: 'non disponibles' };
    const refreshNotif = () => {
      const p = api.notificationPermission();
      status.textContent = labels[p] ?? '';
      U.$('[data-allow-notif]', root).hidden = p === 'granted' || p === 'unsupported';
    };
    refreshNotif();
    U.$('[data-allow-notif]', root).onclick = async () => {
      await api.requestNotifications();
      refreshNotif();
    };
  }

  // Retire le préfixe technique ajouté par Electron aux erreurs IPC
  const cleanError = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

  return { init, render };
})();
