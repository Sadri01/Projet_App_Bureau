// Pop-up de rappel affiché au premier plan avec un son.
(async () => {
  let state = await api.getState();
  U.applyTheme(state.settings.theme);
  api.onState((s) => {
    state = s;
    U.applyTheme(s.settings.theme);
  });

  const root = U.$('#root');

  function describe(p) {
    const range = p.end ? `${U.fmtTime(p.start)} – ${U.fmtTime(p.end)}` : U.fmtTime(p.start);
    if (p.kind === 'pomodoro') {
      return {
        kicker: '⏱ Pomodoro',
        when: `Place à : ${p.nextLabel}`,
        actions: [['dismiss', 'OK', 'primary']],
      };
    }
    if (p.kind === 'task') {
      return {
        kicker: p.urgent ? '🔥 Tâche urgente' : '☐ Tâche à faire',
        when: `Échéance : ${U.fmtTime(p.start)}`,
        actions: [
          ['done', '✓ Terminée', 'primary'],
          ['snooze', 'Dans 5 min', ''],
          ['open', 'Voir', ''],
        ],
      };
    }
    if (p.phase === 'before') {
      return {
        kicker: '⏰ Bientôt',
        when: `Dans ${p.minutesBefore} min · ${range}`,
        actions: [
          ['dismiss', 'OK', 'primary'],
          ['snooze', 'Rappeler dans 5 min', ''],
        ],
      };
    }
    if (p.phase === 'test') {
      return { kicker: '🔔 Essai', when: 'Les rappels ressembleront à ça.', actions: [['dismiss', 'Parfait', 'primary']] };
    }
    if (p.kind === 'imported') {
      return { kicker: '📅 Agenda', when: `C'est maintenant · ${range}`, actions: [['dismiss', 'OK', 'primary'], ['snooze', 'Dans 5 min', '']] };
    }
    return {
      kicker: p.snoozed ? '🔔 Rappel' : "🔔 C'est l'heure !",
      when: `${range}`,
      actions: [
        ['done', "J'y vais", 'primary'],
        ['snooze', 'Dans 5 min', ''],
        ['skip', 'Passer', ''],
      ],
    };
  }

  api.onPopup((p) => {
    const d = describe(p);
    const color = p.color || 'var(--accent)';
    root.innerHTML = `<div class="popup pulse">
      <div class="stripe" style="background:${color}"></div>
      <div class="content">
        <div class="kicker"><span>${d.kicker}</span><button class="close" data-a="dismiss" title="Fermer">✕</button></div>
        <div class="title" title="${U.esc(p.title)}">${U.esc(p.title)}</div>
        <div class="when">${U.esc(d.when)}</div>
        ${p.notes ? `<div class="notes">${U.esc(p.notes)}</div>` : ''}
        <div class="actions">${d.actions.map(([a, l, k]) => `<button class="btn ${k}" data-a="${a}">${U.esc(l)}</button>`).join('')}</div>
      </div>
    </div>`;
    U.$$('[data-a]', root).forEach((b) => (b.onclick = () => api.popupAction(b.dataset.a)));
    Sounds.play(state.settings, api.readSound);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') api.popupAction('dismiss');
  });
})();
