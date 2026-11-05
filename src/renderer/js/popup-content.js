// Contenu des pop-ups de rappel, partagé par la fenêtre pop-up du PC et l'appli téléphone.
const PopupContent = (() => {
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
    if (p.kind === 'update') {
      if (p.web) {
        return {
          kicker: '⬆ Mise à jour',
          when: "Une nouvelle version de l'appli est prête.",
          actions: [
            ['install', 'Recharger', 'primary'],
            ['dismiss', 'Plus tard', ''],
          ],
        };
      }
      return {
        kicker: '⬆ Mise à jour',
        when: "Elle s'installera toute seule quand tu quitteras l'appli, ou tout de suite si tu redémarres.",
        actions: [
          ['install', 'Redémarrer maintenant', 'primary'],
          ['dismiss', 'Plus tard', ''],
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

  function html(p) {
    const d = describe(p);
    const color = p.color || 'var(--accent)';
    return `<div class="popup pulse">
      <div class="stripe" style="background:${color}"></div>
      <div class="content">
        <div class="kicker"><span>${d.kicker}</span><button class="close" data-a="dismiss" title="Fermer">✕</button></div>
        <div class="title" title="${U.esc(p.title)}">${U.esc(p.title)}</div>
        <div class="when">${U.esc(d.when)}</div>
        ${p.notes ? `<div class="notes">${U.esc(p.notes)}</div>` : ''}
        <div class="actions">${d.actions.map(([a, l, k]) => `<button class="btn ${k}" data-a="${a}">${U.esc(l)}</button>`).join('')}</div>
      </div>
    </div>`;
  }

  return { describe, html };
})();
