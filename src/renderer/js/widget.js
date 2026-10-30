// Widget de bureau : to-do list ou emploi du temps du jour.
(async () => {
  const type = new URLSearchParams(location.search).get('type') === 'edt' ? 'edt' : 'todo';
  const root = U.$('#root');
  document.documentElement.classList.add('is-widget');
  let state = await api.getState();

  root.innerHTML = `<div class="widget">
    <div class="widget-head">
      <h2>${type === 'todo' ? 'À faire' : "Aujourd'hui"}</h2>
      <button data-open title="Ouvrir Mon Planning">⤢</button>
      <button data-close title="Masquer le widget">✕</button>
    </div>
    <div class="widget-body"></div>
  </div>`;
  const body = U.$('.widget-body', root);
  U.$('[data-open]', root).onclick = () => api.showMain(type === 'todo' ? 'todo' : 'agenda');
  U.$('[data-close]', root).onclick = () => api.closeWidget(type);

  function renderTodo() {
    const tasks = U.sortTasks(state.tasks.filter((t) => t.status === 'urgent' || t.status === 'normal'));
    const hadFocus = document.activeElement?.matches('.add');
    const draft = U.$('.add', body)?.value || '';
    body.innerHTML = `
      <input class="input add" placeholder="+ Ajouter une tâche" value="${U.esc(draft)}">
      ${
        tasks.length
          ? tasks
              .map((t) => {
                const late = t.due && new Date(t.due) < new Date();
                return `<div class="w-task ${t.status}" data-id="${t.id}">
                  <input type="checkbox" class="check">
                  <span class="t" title="${U.esc(t.title)}">${U.esc(t.title)}</span>
                  ${t.due ? `<span class="chip ${late ? 'late' : ''}">${U.esc(U.fmtDue(t.due))}</span>` : ''}
                </div>`;
              })
              .join('')
          : '<div class="empty small">Tout est fait 🎉</div>'
      }`;
    const add = U.$('.add', body);
    if (hadFocus) add.focus();
    add.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || !add.value.trim()) return;
      const p = U.parseQuickAdd(add.value.trim(), state.categories);
      add.value = '';
      if (p.title) await api.upsert('tasks', U.newTask({ title: p.title, status: p.status, categories: p.categories, due: p.due }));
      U.$('.add', body)?.focus();
    });
    U.$$('.w-task .check', body).forEach((cb) =>
      cb.addEventListener('change', () => {
        const t = state.tasks.find((x) => x.id === cb.closest('.w-task').dataset.id);
        if (t) api.upsert('tasks', { ...t, status: 'termine', completedAt: new Date().toISOString() });
      }),
    );
  }

  function renderEdt() {
    const now = new Date();
    const from = Schedule.startOfDay(now);
    const to = Schedule.addDays(from, 1);
    const items = Schedule.occurrencesBetween(state.activities, from, to).map((o) => ({
      start: o.start,
      end: o.end,
      title: o.activity.title,
      color: o.activity.color,
      status: state.log[o.key],
    }));
    for (const ev of state.importedEvents) {
      const s = new Date(ev.start);
      if (s >= from && s < to && !ev.allDay) items.push({ start: s, end: new Date(ev.end), title: ev.title, color: ev.color });
    }
    items.sort((a, b) => a.start - b.start);
    const next = items.find((i) => i.start > now);
    body.innerHTML = `<div class="small muted" style="margin:0 4px 8px">${U.esc(U.fmtDay(now))}</div>
      ${
        items.length
          ? items
              .map((i) => {
                const cls = i.end <= now ? 'past' : i.start <= now ? 'now' : '';
                const badge = cls === 'now' ? 'En cours' : i === next ? 'À venir' : '';
                return `<div class="w-ev ${cls}">
                  <div class="time">${U.fmtTime(i.start)}</div>
                  <div class="bar" style="background:${i.color}"></div>
                  <div>
                    <div class="t">${U.esc(i.title)}${i.status === 'done' ? ' ✓' : ''}</div>
                    <div class="small muted">${U.fmtTime(i.start)} – ${U.fmtTime(i.end)} ${badge ? `<span class="badge">· ${badge}</span>` : ''}</div>
                  </div>
                </div>`;
              })
              .join('')
          : '<div class="empty small">Rien de prévu aujourd\'hui.</div>'
      }`;
  }

  function render() {
    U.applyTheme(state.settings.theme);
    if (type === 'todo') renderTodo();
    else renderEdt();
  }

  api.onState((s) => {
    state = s;
    render();
  });
  render();
  setInterval(() => type === 'edt' && render(), 60 * 1000);
})();
