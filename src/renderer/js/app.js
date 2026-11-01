// Fenêtre principale : navigation et diffusion de l'état aux différentes vues.
const App = {
  state: null,
  view: 'agenda',
  views: { agenda: Agenda, todo: Todo, stats: Stats, brainstorm: Brainstorm, pomodoro: PomodoroView, reglages: Settings },

  async init() {
    this.state = await api.getState();
    U.applyTheme(this.state.settings.theme);
    for (const v of Object.values(this.views)) v.init?.();

    U.$$('.nav-btn').forEach((b) => b.addEventListener('click', () => this.show(b.dataset.view)));
    U.$('#mini-pomo').addEventListener('click', () => this.show('pomodoro'));

    api.onState((state) => {
      this.state = state;
      U.applyTheme(state.settings.theme);
      this.renderChrome();
      this.views[this.view].render(state);
    });
    api.onNavigate((view) => this.show(view));
    api.onPomodoro((p) => {
      this.renderMiniPomo(p);
      PomodoroView.update(p);
    });
    this.renderMiniPomo(await api.pomodoroState());

    let last = '';
    try {
      last = localStorage.getItem('vue') || '';
    } catch {}
    this.show(this.views[last] ? last : 'agenda');
    // Rafraîchit l'indicateur « ne pas déranger » et la ligne de l'heure
    setInterval(() => {
      this.renderChrome();
      if (this.view === 'agenda') Agenda.updateNowLine();
    }, 60 * 1000);
  },

  show(view) {
    if (!this.views[view]) return;
    if (this.view === 'brainstorm' && view !== 'brainstorm') Brainstorm.flush();
    this.view = view;
    try {
      localStorage.setItem('vue', view);
    } catch {}
    U.$$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    U.$$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    this.renderChrome();
    this.views[view].render(this.state);
  },

  renderChrome() {
    const badge = U.$('#dnd-badge');
    const until = this.state.settings.dndUntil;
    if (until > Date.now()) {
      badge.hidden = false;
      badge.textContent = `🔕 Ne pas déranger jusqu'à ${U.fmtTime(until)}`;
    } else badge.hidden = true;
  },

  renderMiniPomo(p) {
    const box = U.$('#mini-pomo');
    const active = p.running || p.remaining < p.total;
    box.classList.toggle('visible', active && this.view !== 'pomodoro');
    U.$('#mini-pomo-label').textContent = `${p.label}${p.running ? '' : ' (pause)'}`;
    U.$('#mini-pomo-time').textContent = PomodoroView.format(p.remaining);
  },
};

window.addEventListener('beforeunload', () => Brainstorm.flush());

App.init();
