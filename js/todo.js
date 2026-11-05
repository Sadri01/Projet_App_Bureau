// Vue « To-do list » : statuts, catégories, sous-tâches, échéances.
const Todo = (() => {
  let root;
  let filter = { status: 'actives', category: null, search: '' };
  let expanded = null;
  let focusSubtask = false;

  const STATUS_FILTERS = [
    ['actives', 'En cours', '📋'],
    ['urgent', 'Urgent', '🔥'],
    ['normal', 'Normal', '•'],
    ['termine', 'Terminées', '✓'],
    ['abandonne', 'Abandonnées', '✕'],
  ];

  function init() {
    root = U.$('#view-todo');
  }

  function expand(id) {
    expanded = id;
    filter = { status: 'actives', category: null, search: '' };
    const t = App.state.tasks.find((x) => x.id === id);
    if (t && (t.status === 'termine' || t.status === 'abandonne')) filter.status = t.status;
  }

  function matches(t) {
    const f = filter;
    if (f.status === 'actives' && !(t.status === 'urgent' || t.status === 'normal')) return false;
    if (f.status !== 'actives' && t.status !== f.status) return false;
    if (f.category && !(t.categories || []).includes(f.category)) return false;
    if (f.search && !U.normalize(`${t.title} ${t.notes}`).includes(U.normalize(f.search))) return false;
    return true;
  }

  function countFor(state, status, category) {
    return state.tasks.filter((t) => {
      if (category && !(t.categories || []).includes(category)) return false;
      if (status === 'actives') return t.status === 'urgent' || t.status === 'normal';
      return !status || t.status === status;
    }).length;
  }

  function render(state) {
    if (!root || App.view !== 'todo') return;
    const scroll = U.$('.task-list', root)?.scrollTop || 0;
    const tasks = U.sortTasks(state.tasks.filter(matches));
    const catById = Object.fromEntries(state.categories.map((c) => [c.id, c]));

    root.innerHTML = `
      <header class="view-header">
        <h1>To-do list</h1>
        <div class="grow"></div>
        <input class="input" type="search" data-search placeholder="Rechercher…" value="${U.esc(filter.search)}" style="width:220px">
      </header>
      <div class="view-body">
        <div class="todo-layout">
          <aside class="todo-side card">
            <h3>Statut</h3>
            ${STATUS_FILTERS.map(
              ([k, label, icon]) => `<button class="filter-btn ${filter.status === k ? 'active' : ''}" data-status="${k}">
                <span>${icon}</span>${label}<span class="count">${countFor(state, k, filter.category)}</span></button>`,
            ).join('')}
            <h3>Catégories</h3>
            <button class="filter-btn ${!filter.category ? 'active' : ''}" data-category="">Toutes</button>
            ${state.categories
              .map(
                (c) => `<button class="filter-btn ${filter.category === c.id ? 'active' : ''}" data-category="${c.id}">
                <span class="dot" style="background:${c.color}"></span>${U.esc(c.name)}
                <span class="count">${countFor(state, 'actives', c.id)}</span>
                <span class="edit" data-edit-cat="${c.id}" title="Modifier">✎</span></button>`,
              )
              .join('')}
            <button class="btn ghost small" data-add-cat style="margin-top:6px">+ Nouvelle catégorie</button>
          </aside>

          <div class="todo-main">
            <form class="add-bar card" data-add>
              <input class="input title" name="title" placeholder="Nouvelle tâche…  (astuce : !urgent  #sport  @demain 18h)" autocomplete="off">
              <select class="input" name="status">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
              <select class="input" name="category">
                <option value="">Sans catégorie</option>
                ${state.categories.map((c) => `<option value="${c.id}" ${filter.category === c.id ? 'selected' : ''}>${U.esc(c.name)}</option>`).join('')}
              </select>
              <input class="input" type="datetime-local" name="due" title="Échéance (facultatif)">
              <button class="btn primary" type="submit">Ajouter</button>
            </form>
            <div class="task-list">
              ${tasks.length ? groups(tasks, catById) : `<div class="empty">${emptyText()}</div>`}
            </div>
          </div>
        </div>
      </div>`;

    bind(state);
    U.$('.task-list', root).scrollTop = scroll;
    if (focusSubtask) {
      U.$('[data-new-subtask]', root)?.focus();
      focusSubtask = false;
    }
  }

  function emptyText() {
    if (filter.search) return 'Aucune tâche ne correspond à ta recherche.';
    if (filter.status === 'termine') return 'Aucune tâche terminée pour le moment.';
    if (filter.status === 'abandonne') return 'Aucune tâche abandonnée.';
    return 'Rien à faire ici. Ajoute une tâche ci-dessus !';
  }

  function groups(tasks, catById) {
    if (filter.status !== 'actives') return tasks.map((t) => taskHtml(t, catById)).join('');
    const urgent = tasks.filter((t) => t.status === 'urgent');
    const normal = tasks.filter((t) => t.status === 'normal');
    let html = '';
    if (urgent.length) html += `<div class="task-group-title"><h3>🔥 Urgent · ${urgent.length}</h3></div>${urgent.map((t) => taskHtml(t, catById)).join('')}`;
    if (normal.length) html += `<div class="task-group-title"><h3>Normal · ${normal.length}</h3></div>${normal.map((t) => taskHtml(t, catById)).join('')}`;
    return html;
  }

  function taskHtml(t, catById) {
    const subs = t.subtasks || [];
    const doneSubs = subs.filter((s) => s.done).length;
    const late = t.due && new Date(t.due) < new Date() && (t.status === 'urgent' || t.status === 'normal');
    const isOpen = expanded === t.id;
    return `<div class="task ${t.status}" data-id="${t.id}">
      <div class="task-row" data-toggle>
        <input type="checkbox" class="check" data-done ${t.status === 'termine' ? 'checked' : ''} title="Marquer comme terminée">
        <span class="title">${U.esc(t.title)}</span>
        ${(t.categories || [])
          .map((id) => catById[id])
          .filter(Boolean)
          .map((c) => `<span class="chip"><span class="dot" style="background:${c.color}"></span>${U.esc(c.name)}</span>`)
          .join('')}
        ${subs.length ? `<span class="chip">☑ ${doneSubs}/${subs.length}</span>` : ''}
        ${t.due ? `<span class="chip ${late ? 'late' : ''}">⏰ ${U.esc(U.fmtDue(t.due))}</span>` : ''}
        ${t.status === 'termine' && t.completedAt ? `<span class="small muted">le ${U.fmtShort(t.completedAt)}</span>` : ''}
        ${t.status === 'abandonne' ? '<span class="chip">Abandonnée</span>' : ''}
      </div>
      ${isOpen ? detailHtml(t) : ''}
    </div>`;
  }

  function detailHtml(t) {
    const cats = App.state.categories;
    return `<div class="task-detail">
      <label class="field full">Titre <input class="input" data-field="title" value="${U.esc(t.title)}"></label>
      <label class="field">Statut
        <select class="input" data-field="status">
          ${Object.entries(U.STATUS).map(([k, s]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
        </select>
      </label>
      <label class="field">Échéance <input class="input" type="datetime-local" data-field="due" value="${U.toLocalInput(t.due)}"></label>
      <div class="field full">Catégories
        <div class="row wrap">
          ${cats.map((c) => `<span class="chip cat-toggle ${(t.categories || []).includes(c.id) ? 'on' : ''}" data-cat="${c.id}" style="color:${c.color}"><span class="dot" style="background:${c.color}"></span>${U.esc(c.name)}</span>`).join('') || '<span class="muted small">Aucune catégorie</span>'}
        </div>
      </div>
      <div class="field full">Sous-tâches
        <div class="subtasks">
          ${(t.subtasks || [])
            .map(
              (s) => `<label class="subtask ${s.done ? 'done' : ''}" data-sub="${s.id}">
              <input type="checkbox" ${s.done ? 'checked' : ''}><span>${U.esc(s.text)}</span>
              <button class="del" data-del-sub title="Supprimer">✕</button></label>`,
            )
            .join('')}
          <input class="input" data-new-subtask placeholder="+ Ajouter une sous-tâche (Entrée)">
        </div>
      </div>
      <label class="field full">Notes <textarea class="input" data-field="notes" placeholder="Détails, liens…">${U.esc(t.notes)}</textarea></label>
      <div class="full row">
        <button class="btn danger" data-delete>Supprimer</button>
        <div class="grow"></div>
        <button class="btn" data-plan>📅 Planifier dans l'agenda</button>
        <button class="btn" data-close>Fermer</button>
      </div>
    </div>`;
  }

  async function save(task, changes) {
    const next = { ...task, ...changes };
    if (changes.status) {
      next.completedAt = changes.status === 'termine' || changes.status === 'abandonne' ? new Date().toISOString() : null;
    }
    await api.upsert('tasks', next);
  }

  function bind(state) {
    const find = (el) => state.tasks.find((t) => t.id === el.closest('.task')?.dataset.id);

    const search = U.$('[data-search]', root);
    search.addEventListener('input', () => {
      filter.search = search.value;
      render(App.state);
      const s = U.$('[data-search]', root);
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    });

    U.$$('[data-status]', root).forEach((b) => (b.onclick = () => ((filter.status = b.dataset.status), render(App.state))));
    U.$$('[data-category]', root).forEach(
      (b) =>
        (b.onclick = (e) => {
          if (e.target.closest('[data-edit-cat]')) return;
          filter.category = b.dataset.category || null;
          render(App.state);
        }),
    );
    U.$$('[data-edit-cat]', root).forEach((b) => (b.onclick = () => categoryForm(state.categories.find((c) => c.id === b.dataset.editCat))));
    U.$('[data-add-cat]', root).onclick = () => categoryForm();

    U.$('[data-add]', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const text = form.title.value.trim();
      if (!text) return;
      const parsed = U.parseQuickAdd(text, state.categories);
      if (!parsed.title) return;
      const categories = [...parsed.categories];
      if (form.category.value && !categories.includes(form.category.value)) categories.push(form.category.value);
      await api.upsert(
        'tasks',
        U.newTask({
          title: parsed.title,
          status: parsed.status === 'urgent' ? 'urgent' : form.status.value,
          categories,
          due: parsed.due || U.fromLocalInput(form.due.value),
        }),
      );
      U.$('[data-add] [name="title"]', root)?.focus();
    });

    U.$$('[data-toggle]', root).forEach((row) =>
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-done]')) return;
        const id = row.closest('.task').dataset.id;
        expanded = expanded === id ? null : id;
        render(App.state);
      }),
    );
    U.$$('[data-done]', root).forEach((cb) =>
      cb.addEventListener('change', () => save(find(cb), { status: cb.checked ? 'termine' : 'normal' })),
    );

    const detail = U.$('.task-detail', root);
    if (!detail) return;
    const task = find(detail);

    U.$$('[data-field]', detail).forEach((input) =>
      input.addEventListener('change', () => {
        const f = input.dataset.field;
        let value = input.value;
        if (f === 'title') {
          value = value.trim();
          if (!value) return;
        }
        if (f === 'due') value = U.fromLocalInput(value);
        save(task, { [f]: value });
      }),
    );
    U.$$('[data-cat]', detail).forEach((chip) =>
      chip.addEventListener('click', () => {
        const set = new Set(task.categories || []);
        if (set.has(chip.dataset.cat)) set.delete(chip.dataset.cat);
        else set.add(chip.dataset.cat);
        save(task, { categories: [...set] });
      }),
    );
    U.$$('[data-sub]', detail).forEach((row) => {
      const subId = row.dataset.sub;
      U.$('input', row).addEventListener('change', (e) =>
        save(task, { subtasks: task.subtasks.map((s) => (s.id === subId ? { ...s, done: e.target.checked } : s)) }),
      );
      U.$('[data-del-sub]', row).addEventListener('click', (e) => {
        e.preventDefault();
        save(task, { subtasks: task.subtasks.filter((s) => s.id !== subId) });
      });
    });
    U.$('[data-new-subtask]', detail).addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      focusSubtask = true;
      save(task, { subtasks: [...(task.subtasks || []), { id: U.uid(), text: e.target.value.trim(), done: false }] });
    });
    U.$('[data-delete]', detail).onclick = async () => {
      if (!(await Modal.confirm('Supprimer la tâche', `Supprimer « ${task.title} » définitivement ?`))) return;
      expanded = null;
      await api.remove('tasks', task.id);
    };
    U.$('[data-close]', detail).onclick = () => {
      expanded = null;
      render(App.state);
    };
    U.$('[data-plan]', detail).onclick = () => {
      const cat = state.categories.find((c) => (task.categories || []).includes(c.id));
      const next = new Date();
      next.setHours(next.getHours() + 1, 0, 0, 0);
      ActivityForm.open({
        defaults: {
          title: task.title,
          taskId: task.id,
          color: cat?.color || U.PALETTE[6],
          start: Schedule.formatTime(next.getHours() * 60),
          recurrence: { type: 'once', date: Schedule.toDateKey(next) },
        },
      });
    };
  }

  function categoryForm(cat) {
    const isNew = !cat;
    const c = cat || { id: U.uid(), name: '', color: U.PALETTE[App.state.categories.length % U.PALETTE.length] };
    const body = U.h(`<div class="form-grid">
      <label class="field full">Nom <input class="input" name="name" value="${U.esc(c.name)}" placeholder="Ex. : Japonais" maxlength="30"></label>
      <div class="field full">Couleur ${U.swatchesHtml(c.color)}</div>
    </div>`);
    const getColor = U.bindSwatches(body, c.color);
    const save = async () => {
      const name = U.$('[name="name"]', body).value.trim();
      if (!name) {
        U.toast('Donne un nom à la catégorie.', 'error');
        return true;
      }
      await api.upsert('categories', { ...c, name, color: getColor() });
    };
    const actions = [];
    if (!isNew)
      actions.push({
        label: 'Supprimer',
        kind: 'danger',
        left: true,
        onClick: async () => {
          if (!(await Modal.confirm('Supprimer la catégorie', `Supprimer « ${c.name} » ? Les tâches seront conservées.`))) return;
          if (filter.category === c.id) filter.category = null;
          await api.remove('categories', c.id);
        },
      });
    actions.push({ label: 'Annuler' }, { label: isNew ? 'Créer' : 'Enregistrer', kind: 'primary', onClick: save });
    const m = Modal.open({ title: isNew ? 'Nouvelle catégorie' : 'Modifier la catégorie', body, actions });
    U.$('[name="name"]', body).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save().then((keep) => keep !== true && m.close());
    });
  }

  return { init, render, expand };
})();
