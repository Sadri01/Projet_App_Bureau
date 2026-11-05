// Formulaire de création / modification d'une activité de l'emploi du temps.
const ActivityForm = (() => {
  const REMINDERS = [
    ['', 'Réglage par défaut'],
    ['0', 'Aucun rappel avant'],
    ['5', '5 min avant'],
    ['10', '10 min avant'],
    ['15', '15 min avant'],
    ['30', '30 min avant'],
    ['60', '1 h avant'],
  ];

  function blank(defaults = {}) {
    const date = defaults.date || Schedule.toDateKey(new Date());
    return {
      id: U.uid(),
      title: '',
      color: U.PALETTE[0],
      start: '18:00',
      duration: 60,
      recurrence: { type: 'once', date },
      reminder: undefined,
      notes: '',
      exceptions: [],
      ...defaults,
    };
  }

  // occurrence : { dateKey, key } quand on ouvre depuis une case précise de l'agenda
  function open({ activity, occurrence, defaults } = {}) {
    const isNew = !activity;
    const a = structuredClone(activity || blank(defaults));
    const r = a.recurrence || { type: 'once', date: Schedule.toDateKey(new Date()) };
    const date = occurrence?.dateKey || r.date || r.startDate || Schedule.toDateKey(new Date());
    const days = new Set(r.type === 'weekly' ? r.days : [Schedule.fromDateKey(date).getDay()]);
    const log = App.state.log;
    const status = occurrence ? log[occurrence.key] || '' : '';
    const end = Schedule.formatTime(Schedule.parseTime(a.start) + Number(a.duration));
    const task = a.taskId ? App.state.tasks.find((t) => t.id === a.taskId) : null;

    const body = U.h(`<div class="form-grid">
      <label class="field full">Titre
        <input class="input" name="title" value="${U.esc(a.title)}" placeholder="Ex. : Japonais" maxlength="80">
      </label>
      <div class="field full">Couleur ${U.swatchesHtml(a.color)}</div>
      <label class="field">Début <input class="input" type="time" name="start" value="${a.start}"></label>
      <label class="field">Fin <input class="input" type="time" name="end" value="${end}"></label>
      <label class="field full">Répétition
        <select class="input" name="rtype">
          <option value="once" ${r.type === 'once' ? 'selected' : ''}>Une seule fois</option>
          <option value="daily" ${r.type === 'daily' ? 'selected' : ''}>Tous les jours</option>
          <option value="weekly" ${r.type === 'weekly' ? 'selected' : ''}>Certains jours de la semaine</option>
        </select>
      </label>
      <label class="field full" data-show="once">Date <input class="input" type="date" name="date" value="${date}"></label>
      <div class="field full" data-show="weekly">Jours
        <div class="days-picker">
          ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" data-day="${d}" class="${days.has(d) ? 'on' : ''}" title="${U.DAYS_FULL[d]}">${U.DAYS_LETTER[d]}</button>`).join('')}
        </div>
      </div>
      <label class="field" data-show="daily weekly">À partir du <input class="input" type="date" name="startDate" value="${r.startDate || date}"></label>
      <label class="field" data-show="daily weekly">Jusqu'au (facultatif) <input class="input" type="date" name="endDate" value="${r.endDate || ''}"></label>
      <label class="field full">Rappel
        <select class="input" name="reminder">
          ${REMINDERS.map(([v, l]) => `<option value="${v}" ${String(a.reminder ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </label>
      <label class="field full">Notes <textarea class="input" name="notes" placeholder="Matériel, objectif...">${U.esc(a.notes)}</textarea></label>
      ${task ? `<div class="full small muted">Liée à la tâche : <b>${U.esc(task.title)}</b></div>` : ''}
      ${
        occurrence
          ? `<div class="field full">Le ${U.fmtDay(Schedule.fromDateKey(occurrence.dateKey))}, cette activité a été :
          <div class="row" data-status>
            <button type="button" class="btn small ${status === 'done' ? 'active' : ''}" data-st="done">✓ Faite</button>
            <button type="button" class="btn small ${status === 'skipped' ? 'active' : ''}" data-st="skipped">✕ Passée</button>
            <button type="button" class="btn small ${status === '' ? 'active' : ''}" data-st="">Non renseigné</button>
          </div></div>`
          : ''
      }
    </div>`);

    const getColor = U.bindSwatches(body, a.color);
    const field = (n) => U.$(`[name="${n}"]`, body);

    const syncVisibility = () => {
      const t = field('rtype').value;
      U.$$('[data-show]', body).forEach((el) => (el.style.display = el.dataset.show.split(' ').includes(t) ? '' : 'none'));
    };
    field('rtype').addEventListener('change', syncVisibility);
    syncVisibility();

    U.$('.days-picker', body).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = Number(b.dataset.day);
      if (days.has(d)) days.delete(d);
      else days.add(d);
      b.classList.toggle('on', days.has(d));
    });

    let newStatus = status;
    U.$('[data-status]', body)?.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      newStatus = b.dataset.st;
      U.$$('button', e.currentTarget).forEach((x) => x.classList.toggle('active', x === b));
    });

    const save = async () => {
      const title = field('title').value.trim();
      if (!title) {
        U.toast('Donne un titre à ton activité.', 'error');
        field('title').focus();
        return true;
      }
      const startMin = Schedule.parseTime(field('start').value);
      let endMin = Schedule.parseTime(field('end').value);
      if (endMin <= startMin) endMin += 1440;
      const type = field('rtype').value;
      if (type === 'weekly' && !days.size) {
        U.toast('Choisis au moins un jour.', 'error');
        return true;
      }
      const recurrence =
        type === 'once'
          ? { type, date: field('date').value || date }
          : {
              type,
              days: type === 'weekly' ? [...days].sort() : undefined,
              startDate: field('startDate').value || undefined,
              endDate: field('endDate').value || undefined,
            };
      const reminder = field('reminder').value;
      const updated = {
        ...a,
        title,
        color: getColor(),
        start: Schedule.formatTime(startMin),
        duration: endMin - startMin,
        recurrence,
        reminder: reminder === '' ? undefined : Number(reminder),
        notes: field('notes').value.trim(),
      };
      await api.upsert('activities', updated);
      if (occurrence && newStatus !== status) await api.setLog(occurrence.key, newStatus || null);
      U.toast(isNew ? 'Activité ajoutée' : 'Activité enregistrée');
    };

    const actions = [];
    if (!isNew) {
      actions.push({
        label: 'Supprimer',
        kind: 'danger',
        left: true,
        onClick: async () => {
          if (occurrence && a.recurrence?.type !== 'once') {
            Modal.open({
              title: 'Supprimer une activité répétée',
              body: `<p>Supprimer seulement le ${U.esc(U.fmtDay(Schedule.fromDateKey(occurrence.dateKey)))}, ou toutes les séances ?</p>`,
              actions: [
                { label: 'Annuler' },
                {
                  label: 'Seulement ce jour',
                  onClick: () =>
                    api.upsert('activities', { ...activity, exceptions: [...(activity.exceptions || []), occurrence.dateKey] }),
                },
                { label: 'Toutes', kind: 'primary', onClick: () => api.remove('activities', a.id) },
              ],
            });
            return true;
          }
          if (await Modal.confirm('Supprimer', `Supprimer « ${a.title} » ?`)) await api.remove('activities', a.id);
        },
      });
      actions.push({
        label: '⏱ Pomodoro',
        onClick: async () => {
          await api.pomodoro('reset');
          await api.pomodoro('start', a.title);
          App.show('pomodoro');
        },
      });
    }
    actions.push({ label: 'Annuler' }, { label: isNew ? 'Ajouter' : 'Enregistrer', kind: 'primary', onClick: save });

    const m = Modal.open({ title: isNew ? 'Nouvelle activité' : "Modifier l'activité", body, actions });
    field('title').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save().then((keep) => keep !== true && m.close());
    });
    field('title').select();
  }

  return { open, blank };
})();
