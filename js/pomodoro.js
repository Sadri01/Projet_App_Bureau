// Vue « Pomodoro » : minuteur concentration / pause (le décompte tourne dans le processus principal).
const PomodoroView = (() => {
  let root;
  let last = null;
  const R = 108;
  const CIRC = 2 * Math.PI * R;

  function init() {
    root = U.$('#view-pomodoro');
  }

  function format(ms) {
    const s = Math.ceil(ms / 1000);
    return `${Schedule.pad(Math.floor(s / 60))}:${Schedule.pad(s % 60)}`;
  }

  async function render(state) {
    if (!root || App.view !== 'pomodoro') return;
    const cfg = state.settings.pomodoro;
    last = last || (await api.pomodoroState());
    root.innerHTML = `
      <header class="view-header"><h1>Pomodoro</h1></header>
      <div class="view-body" style="overflow:auto">
        <div class="pomo card">
          <div class="muted" data-activity></div>
          <div class="pomo-ring">
            <svg viewBox="0 0 240 240">
              <circle cx="120" cy="120" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="12"/>
              <circle cx="120" cy="120" r="${R}" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${CIRC}" data-progress/>
            </svg>
            <div class="center">
              <div class="time" data-time></div>
              <div class="muted" data-phase></div>
            </div>
          </div>
          <div class="row">
            <button class="btn primary" data-toggle style="min-width:120px;justify-content:center"></button>
            <button class="btn" data-skip title="Passer à la phase suivante">Passer ⏭</button>
            <button class="btn ghost" data-reset>Réinitialiser</button>
          </div>
          <div class="muted small" data-cycles></div>
          <div class="row wrap" style="justify-content:center">
            <label class="field">Concentration (min)<input class="input" type="number" min="1" max="180" name="work" value="${cfg.work}" style="width:110px"></label>
            <label class="field">Petite pause<input class="input" type="number" min="1" max="60" name="shortBreak" value="${cfg.shortBreak}" style="width:110px"></label>
            <label class="field">Grande pause<input class="input" type="number" min="1" max="120" name="longBreak" value="${cfg.longBreak}" style="width:110px"></label>
            <label class="field">Grande pause toutes les<input class="input" type="number" min="1" max="12" name="cyclesBeforeLong" value="${cfg.cyclesBeforeLong}" style="width:110px"></label>
          </div>
        </div>
      </div>`;

    U.$('[data-toggle]', root).onclick = () => api.pomodoro(last?.running ? 'pause' : 'start');
    U.$('[data-skip]', root).onclick = () => api.pomodoro('skip');
    U.$('[data-reset]', root).onclick = () => api.pomodoro('reset');
    U.$$('input[type="number"]', root).forEach((input) =>
      input.addEventListener('change', () => {
        const v = Math.max(1, Math.round(Number(input.value) || 1));
        api.setSettings({ pomodoro: { [input.name]: v } });
      }),
    );
    update(last);
  }

  function update(p) {
    last = p;
    if (!root || App.view !== 'pomodoro' || !U.$('[data-time]', root)) return;
    U.$('[data-time]', root).textContent = format(p.remaining);
    U.$('[data-phase]', root).textContent = p.label;
    U.$('[data-toggle]', root).textContent = p.running ? '⏸ Pause' : p.remaining < p.total ? '▶ Reprendre' : '▶ Démarrer';
    U.$('[data-cycles]', root).textContent = `${p.cycles} session${p.cycles > 1 ? 's' : ''} de concentration terminée${p.cycles > 1 ? 's' : ''}`;
    U.$('[data-activity]', root).textContent = p.activityTitle ? `Activité : ${p.activityTitle}` : '';
    const ring = U.$('[data-progress]', root);
    ring.style.stroke = p.phase === 'work' ? 'var(--accent)' : 'var(--success)';
    ring.setAttribute('stroke-dashoffset', String(CIRC * (1 - p.remaining / p.total)));
  }

  return { init, render, update, format };
})();
