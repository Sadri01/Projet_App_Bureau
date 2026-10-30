// Petite fenêtre « ajouter une tâche » ouverte par raccourci clavier.
(async () => {
  let state = await api.getState();
  U.applyTheme(state.settings.theme);
  api.onState((s) => {
    state = s;
    U.applyTheme(s.settings.theme);
  });

  const root = U.$('#root');
  root.innerHTML = `<div class="quick">
    <input placeholder="Nouvelle tâche…" autofocus>
    <div class="preview"></div>
    <div class="hint"><kbd>Entrée</kbd> ajouter · <kbd>Échap</kbd> fermer · <b>!urgent</b> · <b>#catégorie</b> · <b>@demain 18h</b></div>
  </div>`;
  const input = U.$('input', root);
  const preview = U.$('.preview', root);

  function updatePreview() {
    const p = U.parseQuickAdd(input.value, state.categories);
    const chips = [];
    if (p.status === 'urgent') chips.push('<span class="chip urgent">🔥 Urgent</span>');
    for (const id of p.categories) {
      const c = state.categories.find((x) => x.id === id);
      if (c) chips.push(`<span class="chip"><span class="dot" style="background:${c.color}"></span>${U.esc(c.name)}</span>`);
    }
    if (p.due) chips.push(`<span class="chip">⏰ ${U.esc(U.fmtDue(p.due))}</span>`);
    preview.innerHTML = chips.join('');
  }

  input.addEventListener('input', updatePreview);
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      updatePreview();
      api.closeQuickAdd();
    }
    if (e.key === 'Enter' && input.value.trim()) {
      const p = U.parseQuickAdd(input.value.trim(), state.categories);
      if (!p.title) return;
      await api.upsert('tasks', U.newTask({ title: p.title, status: p.status, categories: p.categories, due: p.due }));
      input.value = '';
      updatePreview();
      api.closeQuickAdd();
    }
  });
  api.onQuickAddReset(() => {
    input.value = '';
    updatePreview();
    input.focus();
  });
  input.focus();
})();
