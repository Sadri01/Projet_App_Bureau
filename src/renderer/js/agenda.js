// Vue « Emploi du temps » : semaine type agenda avec glisser-déposer.
const Agenda = (() => {
  const HOUR = 48;
  const SNAP = 15;
  // Premier jour affiché : le lundi sur PC, aujourd'hui sur téléphone (3 jours visibles)
  const numDays = () => (window.innerWidth <= 760 ? 3 : 7);
  const firstDay = () => (numDays() === 7 ? Schedule.startOfWeek(new Date()) : Schedule.startOfDay(new Date()));
  let weekStart = firstDay();
  let shownDays = numDays();
  let showSide = true;
  let scrolledOnce = false;
  let drag = null;
  let root;

  function init() {
    root = U.$('#view-agenda');
    try {
      showSide = localStorage.getItem('agenda-side') !== '0';
    } catch {}
    document.addEventListener('keydown', (e) => {
      if (App.view !== 'agenda' || Modal.isOpen() || e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') move(-numDays());
      if (e.key === 'ArrowRight') move(numDays());
    });
    // Passage PC <-> téléphone (ou fenêtre redimensionnée) : on repart d'aujourd'hui
    window.addEventListener('resize', () => {
      if (numDays() === shownDays) return;
      shownDays = numDays();
      weekStart = firstDay();
      if (App.view === 'agenda') render(App.state);
    });
  }

  function move(days) {
    weekStart = days === 0 ? firstDay() : Schedule.addDays(weekStart, days);
    render(App.state);
  }

  const range = (s) => ({ startMin: s.settings.dayStart * 60, endMin: Math.max(s.settings.dayEnd, s.settings.dayStart + 1) * 60 });

  function weekLabel() {
    const end = Schedule.addDays(weekStart, numDays() - 1);
    const sameMonth = end.getMonth() === weekStart.getMonth();
    const a = weekStart.toLocaleDateString('fr-FR', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
    const b = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${a} – ${b}`;
  }

  // Événements de la semaine, rangés par jour (0 = lundi)
  function collect(state) {
    const days = Array.from({ length: numDays() }, () => ({ timed: [], allDay: [] }));
    const weekEnd = Schedule.addDays(weekStart, numDays());
    const index = (d) => Math.floor((Schedule.startOfDay(d) - weekStart) / Schedule.DAY_MS + 0.01);

    for (const occ of Schedule.occurrencesBetween(state.activities, weekStart, weekEnd)) {
      days[index(occ.start)].timed.push({
        start: occ.start,
        end: occ.end,
        title: occ.activity.title,
        color: occ.activity.color,
        activity: occ.activity,
        occ,
        status: state.log[occ.key] || '',
      });
    }
    for (const ev of state.importedEvents) {
      const start = new Date(ev.start);
      if (start < weekStart || start >= weekEnd) continue;
      const item = { start, end: new Date(ev.end), title: ev.title, color: ev.color, imported: ev };
      if (ev.allDay) days[index(start)].allDay.push(item);
      else days[index(start)].timed.push(item);
    }
    for (const t of state.tasks) {
      if (!t.due || t.status === 'termine' || t.status === 'abandonne') continue;
      const due = new Date(t.due);
      if (due < weekStart || due >= weekEnd) continue;
      days[index(due)].allDay.push({ task: t, title: `☐ ${t.title}`, color: t.status === 'urgent' ? '#e34948' : '#8a8f98' });
    }
    return days;
  }

  function render(state) {
    if (!root || App.view !== 'agenda') return;
    const prevScroll = U.$('.week-scroll', root)?.scrollTop;
    const { startMin, endMin } = range(state);
    const days = collect(state);
    const todayKey = Schedule.toDateKey(new Date());
    const plannedTaskIds = new Set(state.activities.map((a) => a.taskId).filter(Boolean));
    const openTasks = U.sortTasks(state.tasks.filter((t) => t.status === 'urgent' || t.status === 'normal'));

    root.innerHTML = `
      <header class="view-header">
        <h1>Emploi du temps</h1>
        <div class="row">
          <button class="btn icon" data-act="prev" title="Précédent">‹</button>
          <button class="btn" data-act="today">Aujourd'hui</button>
          <button class="btn icon" data-act="next" title="Suivant">›</button>
          <span class="muted" style="margin-left:6px">${weekLabel()}</span>
        </div>
        <div class="grow"></div>
        <button class="btn ${showSide ? 'active' : ''}" data-act="side">Tâches à planifier</button>
        <button class="btn primary" data-act="add">+ Activité</button>
      </header>
      <div class="view-body">
        <div class="agenda-layout ${showSide ? '' : 'no-side'}">
          ${
            showSide
              ? `<aside class="agenda-side card">
            <h3>Glisse une tâche dans l'agenda</h3>
            ${
              openTasks.length
                ? openTasks
                    .map(
                      (t) => `<div class="plan-task" draggable="true" data-task="${t.id}" title="Glisser vers un créneau">
                  ${t.status === 'urgent' ? '<span class="chip urgent">Urgent</span>' : ''}
                  <span class="grow">${U.esc(t.title)}</span>
                  ${plannedTaskIds.has(t.id) ? '<span title="Déjà planifiée">📅</span>' : ''}
                </div>`,
                    )
                    .join('')
                : '<div class="muted small">Aucune tâche en cours.</div>'
            }
          </aside>`
              : ''
          }
          <div class="week card" style="--hour:${HOUR}px;--days:${days.length}">
            <div class="week-head">
              <div></div>
              ${days
                .map((_, i) => {
                  const d = Schedule.addDays(weekStart, i);
                  const isToday = Schedule.toDateKey(d) === todayKey;
                  return `<div class="day-label ${isToday ? 'today' : ''}">${U.DAYS_SHORT[d.getDay()]}<b>${d.getDate()}</b></div>`;
                })
                .join('')}
            </div>
            ${
              days.some((d) => d.allDay.length)
                ? `<div class="allday-row"><div class="small muted" style="padding:6px 8px 0 0;text-align:right">Jour</div>
              ${days
                .map(
                  (d) =>
                    `<div class="cell">${d.allDay
                      .map(
                        (ev) =>
                          `<div class="ev" style="background:${ev.color};color:${U.readableOn(ev.color)}" ${ev.task ? `data-open-task="${ev.task.id}"` : ''} title="${U.esc(ev.title)}">${U.esc(ev.title)}</div>`,
                      )
                      .join('')}</div>`,
                )
                .join('')}</div>`
                : ''
            }
            <div class="week-scroll">
              <div class="week-grid">
                <div class="hours">
                  ${Array.from({ length: (endMin - startMin) / 60 }, (_, i) => `<div class="hour">${i === 0 ? '' : `${Schedule.pad(startMin / 60 + i)}:00`}</div>`).join('')}
                </div>
                ${days.map((d, i) => dayColumn(d, i, startMin, endMin, todayKey)).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`;

    bind(state);
    updateNowLine();

    const scroller = U.$('.week-scroll', root);
    if (prevScroll !== undefined && scrolledOnce) scroller.scrollTop = prevScroll;
    else {
      const now = new Date();
      scroller.scrollTop = Math.max(0, ((now.getHours() * 60 - startMin) / 60 - 1.5) * HOUR);
      scrolledOnce = true;
    }
  }

  function dayColumn(day, i, startMin, endMin, todayKey) {
    const date = Schedule.addDays(weekStart, i);
    const key = Schedule.toDateKey(date);
    const blocks = Schedule.layoutDay(day.timed)
      .map(({ ev, col, cols }) => {
        const s = ev.start.getHours() * 60 + ev.start.getMinutes();
        const dur = Math.max(15, (ev.end - ev.start) / 60000);
        const top = Math.max(0, s - startMin);
        const bottom = Math.min(endMin - startMin, s - startMin + dur);
        if (bottom <= 0 || top >= endMin - startMin) return '';
        const height = Math.max(18, ((bottom - top) / 60) * HOUR);
        const fg = U.readableOn(ev.color);
        const time = `${U.fmtTime(ev.start)} – ${U.fmtTime(ev.end)}`;
        const cls = ['block', ev.imported ? 'imported' : '', ev.status].join(' ');
        const data = ev.imported ? '' : `data-activity="${ev.activity.id}" data-date="${ev.occ.dateKey}"`;
        return `<div class="${cls}" ${data}
            style="top:${(top / 60) * HOUR}px;height:${height}px;left:calc(${(col / cols) * 100}% + 2px);width:calc(${100 / cols}% - 4px);background:${ev.color};color:${fg}"
            title="${U.esc(ev.title)}\n${time}${ev.imported?.location ? `\n${U.esc(ev.imported.location)}` : ''}">
          <div class="t">${U.esc(ev.title)}</div>
          ${height > 30 ? `<div class="h">${time}</div>` : ''}
          ${ev.imported ? '' : '<div class="resize"></div>'}
        </div>`;
      })
      .join('');
    return `<div class="day-col ${key === todayKey ? 'today' : ''}" data-day="${i}" data-date="${key}" style="height:${((endMin - startMin) / 60) * HOUR}px">${blocks}</div>`;
  }

  function updateNowLine() {
    if (!root) return;
    U.$$('.now-line', root).forEach((n) => n.remove());
    const col = U.$(`.day-col[data-date="${Schedule.toDateKey(new Date())}"]`, root);
    if (!col) return;
    const { startMin, endMin } = range(App.state);
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    if (m < startMin || m > endMin) return;
    const line = U.h('<div class="now-line"></div>');
    line.style.top = `${((m - startMin) / 60) * HOUR}px`;
    col.appendChild(line);
  }

  function minutesAt(col, clientY, snap = SNAP) {
    const { startMin, endMin } = range(App.state);
    const rect = col.getBoundingClientRect();
    const raw = ((clientY - rect.top) / HOUR) * 60 + startMin;
    return Math.min(endMin, Math.max(startMin, Math.round(raw / snap) * snap));
  }

  function columnAt(clientX) {
    return U.$$('.day-col', root).find((c) => {
      const r = c.getBoundingClientRect();
      return clientX >= r.left && clientX < r.right;
    });
  }

  function bind(state) {
    U.$('[data-act="prev"]', root).onclick = () => move(-numDays());
    U.$('[data-act="next"]', root).onclick = () => move(numDays());
    U.$('[data-act="today"]', root).onclick = () => move(0);
    U.$('[data-act="add"]', root).onclick = () => ActivityForm.open();
    U.$('[data-act="side"]', root).onclick = () => {
      showSide = !showSide;
      try {
        localStorage.setItem('agenda-side', showSide ? '1' : '0');
      } catch {}
      render(App.state);
    };
    U.$$('[data-open-task]', root).forEach((el) => {
      el.style.cursor = 'pointer';
      el.onclick = () => {
        Todo.expand(el.dataset.openTask);
        App.show('todo');
      };
    });

    // Glisser une tâche vers un créneau
    U.$$('.plan-task', root).forEach((el) =>
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', el.dataset.task);
        e.dataTransfer.effectAllowed = 'copy';
      }),
    );
    U.$$('.day-col', root).forEach((col) => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drop-target');
      });
      col.addEventListener('dragleave', () => col.classList.remove('drop-target'));
      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drop-target');
        const task = state.tasks.find((t) => t.id === e.dataTransfer.getData('text/plain'));
        if (!task) return;
        const cat = state.categories.find((c) => task.categories?.includes(c.id));
        const start = minutesAt(col, e.clientY, 30);
        await api.upsert(
          'activities',
          ActivityForm.blank({
            title: task.title,
            taskId: task.id,
            color: cat?.color || U.PALETTE[6],
            start: Schedule.formatTime(start),
            duration: 60,
            recurrence: { type: 'once', date: col.dataset.date },
          }),
        );
        U.toast(`« ${task.title} » planifiée à ${Schedule.formatTime(start)}`);
      });
    });

    const grid = U.$('.week-grid', root);
    grid.addEventListener('pointerdown', onPointerDown);
  }

  // ---------- Déplacer, redimensionner, créer en glissant ----------

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const block = e.target.closest('.block');
    const col = e.target.closest('.day-col');
    if (!col) return;
    if (block?.classList.contains('imported')) return;
    if (e.pointerType === 'touch') return onTouchDown(e, block, col);

    if (block) {
      const activity = App.state.activities.find((a) => a.id === block.dataset.activity);
      if (!activity) return;
      drag = {
        mode: e.target.classList.contains('resize') ? 'resize' : 'move',
        block,
        activity,
        dateKey: block.dataset.date,
        x: e.clientX,
        y: e.clientY,
        offsetMin: minutesAt(col, e.clientY, 1) - Schedule.parseTime(activity.start),
        moved: false,
        col,
      };
    } else {
      const m = minutesAt(col, e.clientY, 30);
      const ghost = U.h('<div class="block dragging" style="left:2px;right:2px"></div>');
      ghost.style.background = 'var(--accent)';
      drag = { mode: 'create', col, startMin: m, endMin: m + 30, x: e.clientX, y: e.clientY, moved: false, ghost };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.addEventListener('pointermove', onPointerMove);
    e.currentTarget.addEventListener('pointerup', onPointerUp, { once: true });
  }

  // Au doigt : pas de glisser-déposer (le doigt sert à faire défiler), un simple appui suffit
  function onTouchDown(e, block, col) {
    const grid = e.currentTarget;
    const start = { x: e.clientX, y: e.clientY };
    const minutes = minutesAt(col, e.clientY, 30);
    const cleanup = () => {
      grid.removeEventListener('pointerup', up);
      grid.removeEventListener('pointercancel', cleanup);
    };
    const up = (ev) => {
      cleanup();
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 10) return;
      if (block) {
        const activity = App.state.activities.find((a) => a.id === block.dataset.activity);
        const dateKey = block.dataset.date;
        if (activity) ActivityForm.open({ activity, occurrence: { dateKey, key: Schedule.occurrenceKey(activity.id, dateKey) } });
      } else {
        ActivityForm.open({ defaults: { start: Schedule.formatTime(minutes), duration: 60, recurrence: { type: 'once', date: col.dataset.date } } });
      }
    };
    grid.addEventListener('pointerup', up);
    grid.addEventListener('pointercancel', cleanup);
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
    drag.moved = true;
    const { startMin } = range(App.state);

    if (drag.mode === 'move') {
      const col = columnAt(e.clientX) || drag.col;
      const s = Math.round((minutesAt(col, e.clientY, 1) - drag.offsetMin) / SNAP) * SNAP;
      drag.newStart = Math.max(0, Math.min(1440 - SNAP, s));
      drag.newCol = col;
      if (drag.block.parentElement !== col) col.appendChild(drag.block);
      Object.assign(drag.block.style, { left: '2px', width: 'calc(100% - 4px)', top: `${((drag.newStart - startMin) / 60) * HOUR}px` });
      drag.block.classList.add('dragging');
      setBlockTime(drag.block, drag.newStart, drag.activity.duration);
    } else if (drag.mode === 'resize') {
      const end = minutesAt(drag.col, e.clientY);
      const begin = Schedule.parseTime(drag.activity.start);
      drag.newDuration = Math.max(SNAP, end - begin);
      drag.block.style.height = `${(drag.newDuration / 60) * HOUR}px`;
      drag.block.classList.add('dragging');
      setBlockTime(drag.block, begin, drag.newDuration);
    } else if (drag.mode === 'create') {
      const m = minutesAt(drag.col, e.clientY, SNAP);
      const a = Math.min(drag.startMin, m);
      const b = Math.max(drag.startMin + SNAP, m);
      drag.from = a;
      drag.to = b;
      if (!drag.ghost.parentElement) drag.col.appendChild(drag.ghost);
      Object.assign(drag.ghost.style, { top: `${((a - startMin) / 60) * HOUR}px`, height: `${((b - a) / 60) * HOUR}px` });
      drag.ghost.textContent = `${Schedule.formatTime(a)} – ${Schedule.formatTime(b)}`;
    }
  }

  function setBlockTime(block, start, duration) {
    const h = U.$('.h', block);
    if (h) h.textContent = `${Schedule.formatTime(start)} – ${Schedule.formatTime(start + Number(duration))}`;
  }

  async function onPointerUp(e) {
    e.currentTarget.removeEventListener('pointermove', onPointerMove);
    const d = drag;
    drag = null;
    if (!d) return;

    if (d.mode === 'create') {
      d.ghost.remove();
      const start = d.moved ? d.from : d.startMin;
      const duration = d.moved ? d.to - d.from : 60;
      ActivityForm.open({
        defaults: { start: Schedule.formatTime(start), duration, recurrence: { type: 'once', date: d.col.dataset.date } },
      });
      return;
    }

    const a = d.activity;
    const occurrence = { dateKey: d.dateKey, key: Schedule.occurrenceKey(a.id, d.dateKey) };
    if (!d.moved) {
      ActivityForm.open({ activity: a, occurrence });
      return;
    }

    if (d.mode === 'resize') {
      await api.upsert('activities', { ...a, duration: d.newDuration });
      return;
    }

    const newDate = d.newCol.dataset.date;
    const updated = { ...a, start: Schedule.formatTime(d.newStart), recurrence: { ...a.recurrence } };
    if (newDate !== d.dateKey) {
      const r = updated.recurrence;
      if (r.type === 'once') r.date = newDate;
      else if (r.type === 'weekly') {
        const from = Schedule.fromDateKey(d.dateKey).getDay();
        const to = Schedule.fromDateKey(newDate).getDay();
        r.days = [...new Set(r.days.map((x) => (x === from ? to : x)))].sort();
      }
    }
    await api.upsert('activities', updated);
    if (a.recurrence?.type !== 'once') U.toast('Toutes les séances de cette activité ont été déplacées.');
  }

  return { init, render, updateNowLine };
})();
