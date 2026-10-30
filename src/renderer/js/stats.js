// Vue « Récapitulatif » : temps prévu / réalisé par activité et camembert.
const Stats = (() => {
  let root;
  let period = 'week';
  let ref = new Date();
  let charts = [];

  const PERIODS = { day: 'Jour', week: 'Semaine', month: 'Mois' };

  function init() {
    root = U.$('#view-stats');
  }

  function shift(dir) {
    if (dir === 0) ref = new Date();
    else if (period === 'day') ref = Schedule.addDays(ref, dir);
    else if (period === 'week') ref = Schedule.addDays(ref, 7 * dir);
    else ref = new Date(ref.getFullYear(), ref.getMonth() + dir, 1);
    render(App.state);
  }

  function label(from, to) {
    if (period === 'day') return U.fmtDay(from);
    if (period === 'month') return from.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `${U.fmtShort(from)} – ${U.fmtShort(Schedule.addDays(to, -1))}`;
  }

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function render(state) {
    if (!root || App.view !== 'stats') return;
    const { from, to } = Schedule.periodRange(period, ref);
    const rows = Schedule.summarize(state.activities, state.log, from, to);
    const planned = rows.reduce((s, r) => s + r.planned, 0);
    const done = rows.reduce((s, r) => s + r.done, 0);
    const skipped = rows.reduce((s, r) => s + r.skipped, 0);
    const inRange = (iso) => iso && new Date(iso) >= from && new Date(iso) < to;
    const tasksDone = state.tasks.filter((t) => t.status === 'termine' && inRange(t.completedAt));
    const tasksOpen = state.tasks.filter((t) => t.status === 'urgent' || t.status === 'normal');
    const rate = planned ? Math.round((done / planned) * 100) : 0;

    // Tâches terminées par catégorie
    const byCat = new Map();
    for (const t of tasksDone) {
      const ids = t.categories?.length ? t.categories : [''];
      for (const id of ids) byCat.set(id, (byCat.get(id) || 0) + 1);
    }
    const catRows = [...byCat.entries()]
      .map(([id, n]) => {
        const c = state.categories.find((x) => x.id === id);
        return { name: c?.name || 'Sans catégorie', color: c?.color || '#8a8f98', n };
      })
      .sort((a, b) => b.n - a.n);

    root.innerHTML = `
      <header class="view-header">
        <h1>Récapitulatif</h1>
        <div class="row">
          ${Object.entries(PERIODS).map(([k, l]) => `<button class="btn small ${period === k ? 'active' : ''}" data-period="${k}">${l}</button>`).join('')}
        </div>
        <div class="row">
          <button class="btn icon" data-shift="-1">‹</button>
          <button class="btn small" data-shift="0">Aujourd'hui</button>
          <button class="btn icon" data-shift="1">›</button>
          <span class="muted">${label(from, to)}</span>
        </div>
      </header>
      <div class="view-body">
        <div class="stats-grid">
          <div class="card tile"><div class="label">Temps prévu</div><div class="value">${Schedule.formatDuration(planned)}</div><div class="sub">${rows.reduce((s, r) => s + r.count, 0)} séances</div></div>
          <div class="card tile"><div class="label">Temps réalisé</div><div class="value">${Schedule.formatDuration(done)}</div><div class="sub">${rate} % du prévu${skipped ? ` · ${Schedule.formatDuration(skipped)} passées` : ''}</div></div>
          <div class="card tile"><div class="label">Tâches terminées</div><div class="value">${tasksDone.length}</div><div class="sub">sur la période</div></div>
          <div class="card tile"><div class="label">Tâches en cours</div><div class="value">${tasksOpen.length}</div><div class="sub">${tasksOpen.filter((t) => t.status === 'urgent').length} urgente(s)</div></div>

          <div class="card chart-card">
            <h2>Répartition de mes activités</h2>
            ${rows.length ? '<div class="chart-wrap"><canvas id="chart-activities" aria-label="Camembert des activités"></canvas></div>' : '<div class="empty">Aucune activité sur cette période.</div>'}
          </div>
          <div class="card chart-card">
            <h2>Tâches terminées par catégorie</h2>
            ${catRows.length ? '<div class="chart-wrap"><canvas id="chart-tasks" aria-label="Camembert des tâches terminées"></canvas></div>' : '<div class="empty">Aucune tâche terminée sur cette période.</div>'}
          </div>

          <div class="card recap-card" style="grid-column: 1 / -1">
            <h2 style="margin-bottom:10px">Détail par activité</h2>
            ${
              rows.length
                ? `<table class="recap-table">
              <thead><tr><th>Activité</th><th class="num">Séances</th><th class="num">Prévu</th><th class="num">Fait</th><th class="num">Passé</th><th>Progression</th></tr></thead>
              <tbody>${rows
                .map(
                  (r) => `<tr>
                  <td><span class="row"><span class="dot" style="background:${r.color}"></span>${U.esc(r.title)}</span></td>
                  <td class="num">${r.count}</td>
                  <td class="num">${Schedule.formatDuration(r.planned)}</td>
                  <td class="num">${Schedule.formatDuration(r.done)}</td>
                  <td class="num">${r.skipped ? Schedule.formatDuration(r.skipped) : '–'}</td>
                  <td><div class="row"><div class="progress grow"><div style="width:${r.planned ? (r.done / r.planned) * 100 : 0}%;background:${r.color}"></div></div><span class="small muted">${r.planned ? Math.round((r.done / r.planned) * 100) : 0} %</span></div></td>
                </tr>`,
                )
                .join('')}</tbody>
            </table>
            <p class="small muted" style="margin:10px 0 0">« Fait » se remplit quand tu cliques sur « J'y vais » dans le rappel, ou en ouvrant une séance dans l'emploi du temps.</p>`
                : '<div class="empty">Crée des activités dans l\'emploi du temps pour voir ton récapitulatif.</div>'
            }
          </div>
        </div>
      </div>`;

    U.$$('[data-period]', root).forEach((b) => (b.onclick = () => ((period = b.dataset.period), render(App.state))));
    U.$$('[data-shift]', root).forEach((b) => (b.onclick = () => shift(Number(b.dataset.shift))));

    charts.forEach((c) => c.destroy());
    charts = [];
    if (rows.length) {
      charts.push(
        doughnut('chart-activities', rows.map((r) => r.title), rows.map((r) => r.planned), rows.map((r) => r.color), (v) => Schedule.formatDuration(v)),
      );
    }
    if (catRows.length) {
      charts.push(
        doughnut('chart-tasks', catRows.map((r) => r.name), catRows.map((r) => r.n), catRows.map((r) => r.color), (v) => `${v} tâche${v > 1 ? 's' : ''}`),
      );
    }
  }

  function doughnut(id, labels, values, colors, format) {
    const total = values.reduce((a, b) => a + b, 0);
    return new Chart(U.$(`#${id}`, root), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            // Fin liseré couleur du fond entre les parts
            borderColor: css('--surface'),
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: css('--text-2'),
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              padding: 12,
              font: { family: css('--font') },
              generateLabels: (chart) =>
                Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart).map((l, i) => ({
                  ...l,
                  text: `${labels[i]} · ${Math.round((values[i] / total) * 100)} %`,
                  fontColor: css('--text-2'),
                })),
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${format(ctx.parsed)} (${Math.round((ctx.parsed / total) * 100)} %)`,
            },
          },
        },
      },
    });
  }

  return { init, render };
})();
