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

  function init() {
    root = U.$('#view-reglages');
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

          <section class="card">
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
                <button class="btn" data-choose-sound title="Choisir un fichier MP3, WAV ou OGG">📁 Fichier…</button>
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

          <section class="card">
            <h2>Widgets de bureau</h2>
            <label class="switch"><input type="checkbox" data-widget="todo" ${checked(s.widgets.todo.visible)}>Afficher la to-do list sur le bureau</label>
            <label class="switch"><input type="checkbox" data-widget="edt" ${checked(s.widgets.edt.visible)}>Afficher l’emploi du temps du jour sur le bureau</label>
            <label class="field">Opacité
              <input type="range" min="0.4" max="1" step="0.02" value="${s.widgets.opacity}" data-widget-opacity>
            </label>
            <p class="small muted">Déplace un widget en le tenant par son titre, redimensionne-le par les bords. Il reste sur le bureau, derrière tes fenêtres ;
              appuie sur <kbd>${U.esc(s.shortcuts.widgetsFront || '—')}</kbd> pour le faire passer au premier plan. Il repasse derrière dès que tu cliques ailleurs.</p>
          </section>

          <section class="card">
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
            <p class="small muted" style="margin:0">Google Agenda : Paramètres de l’agenda → « Adresse secrète au format iCal ». Colle ce lien ici.
              Outlook : Paramètres → Calendrier → Calendriers partagés → Publier → lien ICS.</p>
            <div>${s.icsFeeds.length ? s.icsFeeds.map((f) => `<div class="feed"><span class="dot" style="background:${f.color}"></span><span class="grow">${U.esc(f.name)}</span><span class="small muted">${f.url ? 'lien' : 'fichier'}</span><button class="btn small ghost danger" data-remove-feed="${f.id}">Retirer</button></div>`).join('') : '<span class="muted small">Aucun agenda importé.</span>'}</div>
            <form class="row wrap" data-add-feed>
              <input class="input" name="name" placeholder="Nom" style="width:120px" required>
              <input class="input grow" name="url" placeholder="https://… .ics" required>
              <input type="color" class="swatch-custom" name="color" value="#8a8f98" title="Couleur">
              <button class="btn primary" type="submit">Ajouter</button>
            </form>
            <div class="row">
              <button class="btn" data-import-ics>📁 Importer un fichier .ics</button>
              <button class="btn" data-refresh-ics>↻ Actualiser</button>
            </div>
          </section>

          <section class="card">
            <h2>Sauvegarde</h2>
            <p class="small muted" style="margin:0">Une copie de tes données est faite automatiquement chaque jour (10 dernières conservées).</p>
            <div class="row wrap">
              <button class="btn" data-export>⬇ Exporter mes données</button>
              <button class="btn" data-import>⬆ Restaurer une sauvegarde</button>
              <button class="btn ghost" data-open-backups>Ouvrir le dossier des sauvegardes</button>
            </div>
            <p class="small muted" style="margin:0">Version ${U.esc(info.version)}</p>
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
  }

  // Retire le préfixe technique ajouté par Electron aux erreurs IPC
  const cleanError = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

  return { init, render };
})();
