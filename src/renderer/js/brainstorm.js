// Vue « Brainstorming » : tableau blanc infini (dessin, gomme, formes, texte, post-it).
const Brainstorm = (() => {
  const TOOLS = [
    { id: 'select', key: 'V', label: 'Sélection', icon: '<path d="M5 3l14 8-6 2-3 6z"/>' },
    { id: 'hand', key: 'H', label: 'Déplacer la feuille', icon: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.5a1.5 1.5 0 0 1 2.5-1.7L8 16"/>' },
    { id: 'pen', key: 'P', label: 'Crayon', icon: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>' },
    { id: 'marker', key: 'M', label: 'Surligneur', icon: '<path d="M9 15l-4 4h6l1-1"/><path d="M8 14l8-10 4 4-10 8z"/>' },
    { id: 'eraser', key: 'E', label: 'Gomme', icon: '<path d="M8 20h12"/><path d="M4.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8z"/>' },
    { id: 'rect', key: 'R', label: 'Rectangle', icon: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>' },
    { id: 'ellipse', key: 'O', label: 'Cercle', icon: '<ellipse cx="12" cy="12" rx="8.5" ry="7"/>' },
    { id: 'triangle', key: 'G', label: 'Triangle', icon: '<path d="M12 4l9 16H3z"/>' },
    { id: 'diamond', key: 'D', label: 'Losange', icon: '<path d="M12 3l9 9-9 9-9-9z"/>' },
    { id: 'line', key: 'L', label: 'Trait', icon: '<path d="M5 19L19 5"/>' },
    { id: 'arrow', key: 'A', label: 'Flèche', icon: '<path d="M5 19L19 5M10 5h9v9"/>' },
    { id: 'text', key: 'T', label: 'Texte', icon: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>' },
    { id: 'note', key: 'N', label: 'Post-it', icon: '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/>' },
  ];
  const SHAPES = ['rect', 'ellipse', 'triangle', 'diamond'];
  const COLORS = ['ink', '#e34948', '#eb6834', '#eda100', '#1baf7a', '#2a78d6', '#6250d6', '#e87ba4', '#8a8f98', '#ffffff'];
  const NOTE_COLORS = ['#fff1a8', '#ffd3a8', '#ffc4d6', '#c9f2d5', '#c8e3ff', '#e2d4ff'];
  const SIZES = { pen: 4, marker: 22, eraser: 30, shape: 3 };
  const HANDLE = 8;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 8;

  let root;
  let canvas;
  let ctx;
  let dpr = 1;
  let built = false;
  let board = null;
  let boards = [];
  let tool = 'pen';
  let color = 'ink';
  let noteColor = NOTE_COLORS[0];
  let fill = false;
  let fontSize = 20;
  const sizes = { ...SIZES };
  let selection = new Set();
  let action = null;
  let pointer = null;
  let spaceDown = false;
  let editing = null;
  let undoStack = [];
  let redoStack = [];
  let saveTimer = null;
  let frame = 0;

  const uid = () => U.uid();
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ink = () => css('--text') || '#1d1f2b';
  const paint = (c) => (c === 'ink' ? ink() : c);
  const r1 = (n) => Math.round(n * 10) / 10;

  function init() {
    root = U.$('#view-brainstorm');
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        spaceDown = false;
        updateCursor();
      }
    });
    document.addEventListener('paste', onPaste);
  }

  // ---------- Feuilles ----------

  function blankBoard(name) {
    return { id: uid(), name, items: [], view: { x: -40, y: -40, zoom: 1 }, updatedAt: new Date().toISOString() };
  }

  async function loadBoards(selectId) {
    boards = await api.listBoards();
    if (!boards.length) {
      const b = blankBoard('Ma première feuille');
      await api.saveBoard(b);
      boards = await api.listBoards();
    }
    let id = selectId;
    try {
      id = id || localStorage.getItem('feuille');
    } catch {}
    if (!boards.some((b) => b.id === id)) id = boards[0].id;
    await openBoard(id);
  }

  async function openBoard(id) {
    await flushSave();
    board = await api.getBoard(id);
    board.view ||= { x: -40, y: -40, zoom: 1 };
    selection.clear();
    undoStack = [];
    redoStack = [];
    try {
      localStorage.setItem('feuille', id);
    } catch {}
    renderBoardList();
    requestDraw();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 600);
  }

  async function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (board) await api.saveBoard(board);
  }

  // ---------- Historique (annuler / rétablir) ----------

  function snapshot() {
    undoStack.push(JSON.stringify(board.items));
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }

  function changed() {
    scheduleSave();
    requestDraw();
    renderProps();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(board.items));
    board.items = JSON.parse(undoStack.pop());
    selection.clear();
    changed();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(board.items));
    board.items = JSON.parse(redoStack.pop());
    selection.clear();
    changed();
  }

  // ---------- Interface ----------

  function render() {
    if (!root || App.view !== 'brainstorm') return;
    if (!built) {
      build();
      loadBoards();
      return;
    }
    // Changement de thème : les couleurs « encre » et le fond sont recalculés
    requestDraw();
  }

  function build() {
    built = true;
    root.innerHTML = `
      <header class="view-header">
        <h1>Brainstorming</h1>
        <select class="input" data-boards title="Changer de feuille"></select>
        <button class="btn icon" data-new title="Nouvelle feuille">＋</button>
        <button class="btn icon" data-rename title="Renommer">✎</button>
        <button class="btn icon danger" data-delete title="Supprimer la feuille">🗑</button>
        <div class="grow"></div>
        <button class="btn icon" data-undo title="Annuler (Ctrl+Z)">↶</button>
        <button class="btn icon" data-redo title="Rétablir (Ctrl+Y)">↷</button>
        <button class="btn" data-copy title="Copier la feuille en image dans le presse-papiers">📋 Copier l'image</button>
        <button class="btn primary" data-capture title="Enregistrer la feuille en PNG">📷 Capture</button>
      </header>
      <div class="view-body">
        <div class="board card">
          <canvas class="board-canvas"></canvas>
          <div class="board-tools">
            ${TOOLS.map(
              (t, i) =>
                `${[2, 5, 11].includes(i) ? '<span class="sep"></span>' : ''}<button class="tool-btn" data-tool="${t.id}" title="${t.label} (${t.key})">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${t.icon}</svg>
                </button>`,
            ).join('')}
          </div>
          <div class="board-props"></div>
          <div class="board-zoom">
            <button class="btn icon small" data-zoom="-1" title="Dézoomer">−</button>
            <button class="btn small" data-zoom="reset" title="Revenir à 100 %"><span data-zoom-label>100 %</span></button>
            <button class="btn icon small" data-zoom="1" title="Zoomer">+</button>
            <button class="btn small" data-zoom="fit" title="Tout afficher">⤢ Tout voir</button>
          </div>
          <div class="board-hint small muted">Molette : zoom · Espace + glisser : se déplacer · Suppr : effacer la sélection · [ ] : taille</div>
        </div>
      </div>`;

    canvas = U.$('.board-canvas', root);
    ctx = canvas.getContext('2d');
    new ResizeObserver(resize).observe(canvas.parentElement);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', () => {
      pointer = null;
      requestDraw();
    });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    // Clic droit ou molette enfoncée : se déplacer dans la feuille
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    U.$$('[data-tool]', root).forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
    U.$('[data-boards]', root).onchange = (e) => openBoard(e.target.value);
    U.$('[data-new]', root).onclick = newBoard;
    U.$('[data-rename]', root).onclick = renameBoard;
    U.$('[data-delete]', root).onclick = deleteBoard;
    U.$('[data-undo]', root).onclick = undo;
    U.$('[data-redo]', root).onclick = redo;
    U.$('[data-copy]', root).onclick = async () => {
      await api.copyBoardImage(exportImage());
      U.toast('Image copiée : colle-la où tu veux avec Ctrl+V');
    };
    U.$('[data-capture]', root).onclick = async () => {
      const file = await api.saveBoardImage(exportImage(), board.name);
      if (file) U.toast('Capture enregistrée');
    };
    U.$$('[data-zoom]', root).forEach(
      (b) =>
        (b.onclick = () => {
          const z = b.dataset.zoom;
          if (z === 'fit') return fitView();
          if (z === 'reset') return zoomAt(1, canvas.clientWidth / 2, canvas.clientHeight / 2, true);
          zoomAt(board.view.zoom * (z === '1' ? 1.25 : 0.8), canvas.clientWidth / 2, canvas.clientHeight / 2, true);
        }),
    );
    setTool(tool);
  }

  function renderBoardList() {
    const sel = U.$('[data-boards]', root);
    sel.innerHTML = boards.map((b) => `<option value="${b.id}" ${b.id === board.id ? 'selected' : ''}>${U.esc(b.name)}</option>`).join('');
  }

  function askName(title, value) {
    return new Promise((resolve) => {
      const body = U.h(`<label class="field">Nom <input class="input" value="${U.esc(value)}" maxlength="60"></label>`);
      const input = U.$('input', body);
      const ok = () => resolve(input.value.trim() || value);
      const m = Modal.open({ title, body, actions: [{ label: 'Annuler', onClick: () => resolve(null) }, { label: 'OK', kind: 'primary', onClick: ok }] });
      input.select();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          ok();
          m.close();
        }
      });
    });
  }

  async function newBoard() {
    const name = await askName('Nouvelle feuille', `Feuille ${boards.length + 1}`);
    if (!name) return;
    await flushSave();
    const b = blankBoard(name);
    await api.saveBoard(b);
    await loadBoards(b.id);
  }

  async function renameBoard() {
    const name = await askName('Renommer la feuille', board.name);
    if (!name) return;
    board.name = name;
    await flushSave();
    boards = await api.listBoards();
    renderBoardList();
  }

  async function deleteBoard() {
    if (!(await Modal.confirm('Supprimer la feuille', `Supprimer « ${board.name} » et tout son contenu ?`))) return;
    clearTimeout(saveTimer);
    await api.deleteBoard(board.id);
    board = null;
    await loadBoards();
  }

  function setTool(t) {
    commitEdit();
    tool = t;
    if (t !== 'select') selection.clear();
    U.$$('[data-tool]', root).forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    updateCursor();
    renderProps();
    requestDraw();
  }

  function updateCursor() {
    if (!canvas) return;
    let c = 'crosshair';
    if (tool === 'hand' || spaceDown) c = action?.type === 'pan' ? 'grabbing' : 'grab';
    else if (tool === 'select') c = 'default';
    else if (['pen', 'marker', 'eraser'].includes(tool)) c = 'none';
    else if (tool === 'text') c = 'text';
    canvas.style.cursor = c;
  }

  // Barre de propriétés : couleur, taille, remplissage selon l'outil ou la sélection
  function renderProps() {
    const box = U.$('.board-props', root);
    if (!box || !board) return;
    const selected = board.items.filter((i) => selection.has(i.id));
    const ctxTool = selected.length ? selected[0].type : tool;
    const showNoteColors = ctxTool === 'note';
    const sizeKey = ['pen', 'marker', 'eraser'].includes(tool) && !selected.length ? tool : 'shape';
    const showSize = !selected.length ? ['pen', 'marker', 'eraser', ...SHAPES, 'line', 'arrow'].includes(tool) : selected.some((i) => ['stroke', 'shape', 'line'].includes(i.type));
    const showFont = (!selected.length && ['text', 'note'].includes(tool)) || selected.some((i) => ['text', 'note'].includes(i.type));
    const showFill = (!selected.length && SHAPES.includes(tool)) || selected.some((i) => i.type === 'shape');
    const showColors = tool !== 'eraser' && tool !== 'hand' && (tool !== 'select' || selected.length);
    const currentSize = selected.length ? selected.find((i) => i.size)?.size ?? sizes.shape : sizes[sizeKey];

    let html = '';
    if (showColors) {
      const list = showNoteColors ? NOTE_COLORS : COLORS;
      const current = showNoteColors ? (selected[0]?.color ?? noteColor) : (selected.find((i) => i.color)?.color ?? color);
      html += `<div class="prop-colors">${list
        .map((c) => `<button class="color-dot ${c === current ? 'on' : ''}" data-color="${c}" title="${c === 'ink' ? 'Encre (suit le thème)' : c}" style="background:${c === 'ink' ? 'var(--text)' : c}"></button>`)
        .join('')}${showNoteColors ? '' : `<input type="color" class="swatch-custom" data-color-custom value="${current.startsWith('#') ? current : '#000000'}" title="Autre couleur">`}</div>`;
    }
    if (showSize) {
      const max = sizeKey === 'eraser' || tool === 'marker' ? 120 : 40;
      html += `<label class="prop-size" title="Taille ([ et ])">
        <span class="size-preview" style="width:${Math.min(28, Math.max(4, currentSize))}px;height:${Math.min(28, Math.max(4, currentSize))}px"></span>
        <input type="range" min="1" max="${max}" value="${currentSize}" data-size>
        <span class="small muted" data-size-label>${currentSize}px</span></label>`;
    }
    if (showFill) {
      const on = selected.length ? selected.some((i) => i.fill) : fill;
      html += `<label class="switch small"><input type="checkbox" data-fill ${on ? 'checked' : ''}>Rempli</label>`;
    }
    if (showFont) {
      const fs = selected.find((i) => i.fontSize)?.fontSize ?? fontSize;
      html += `<select class="input small" data-font title="Taille du texte">${[14, 16, 20, 28, 40, 64, 96].map((s) => `<option ${s === fs ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
    }
    if (selected.length) {
      html += `<span class="sep"></span>
        <button class="btn small ghost" data-front title="Mettre au premier plan">⬆</button>
        <button class="btn small ghost" data-back title="Mettre à l'arrière-plan">⬇</button>
        <button class="btn small ghost" data-dup title="Dupliquer (Ctrl+D)">⧉</button>
        <button class="btn small ghost danger" data-del title="Supprimer (Suppr)">🗑</button>`;
    }
    if (!selected.length && tool === 'select') html = '<span class="small muted">Clique sur un élément ou encadre-en plusieurs pour les sélectionner</span>';
    if (tool === 'eraser' && !selected.length) html += '<span class="small muted">La gomme efface les traits de crayon et de surligneur</span>';
    if (!selected.length && tool === 'select' && board.items.length) html += '<button class="btn small ghost danger" data-clear>Tout effacer</button>';
    box.innerHTML = html;
    box.hidden = !html;

    const applyToSelection = (fn) => {
      if (!selected.length) return false;
      snapshot();
      selected.forEach(fn);
      changed();
      return true;
    };
    U.$$('[data-color]', box).forEach(
      (b) =>
        (b.onclick = () => {
          const c = b.dataset.color;
          if (!applyToSelection((i) => (i.color = c))) {
            if (showNoteColors) noteColor = c;
            else color = c;
            renderProps();
          }
        }),
    );
    U.$('[data-color-custom]', box)?.addEventListener('change', (e) => {
      const c = e.target.value;
      if (!applyToSelection((i) => i.type !== 'note' && (i.color = c))) {
        color = c;
        renderProps();
      }
    });
    const size = U.$('[data-size]', box);
    size?.addEventListener('input', () => {
      const v = Number(size.value);
      U.$('[data-size-label]', box).textContent = `${v}px`;
      const prev = U.$('.size-preview', box);
      prev.style.width = prev.style.height = `${Math.min(28, Math.max(4, v))}px`;
      if (!selected.length) sizes[sizeKey] = v;
      requestDraw();
    });
    size?.addEventListener('change', () => {
      const v = Number(size.value);
      if (!applyToSelection((i) => i.size !== undefined && (i.size = v))) sizes[sizeKey] = v;
    });
    U.$('[data-fill]', box)?.addEventListener('change', (e) => {
      if (!applyToSelection((i) => i.type === 'shape' && (i.fill = e.target.checked))) fill = e.target.checked;
    });
    U.$('[data-font]', box)?.addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (!applyToSelection((i) => i.fontSize !== undefined && (i.fontSize = v))) fontSize = v;
    });
    U.$('[data-front]', box)?.addEventListener('click', () => reorder(true));
    U.$('[data-back]', box)?.addEventListener('click', () => reorder(false));
    U.$('[data-dup]', box)?.addEventListener('click', duplicate);
    U.$('[data-del]', box)?.addEventListener('click', deleteSelection);
    U.$('[data-clear]', box)?.addEventListener('click', async () => {
      if (!(await Modal.confirm('Tout effacer', 'Effacer tout le contenu de cette feuille ? (Ctrl+Z pour annuler)', 'Effacer'))) return;
      snapshot();
      board.items = [];
      changed();
    });
  }

  // ---------- Repères : écran <-> feuille ----------

  const toWorld = (sx, sy) => ({ x: sx / board.view.zoom + board.view.x, y: sy / board.view.zoom + board.view.y });
  const toScreen = (x, y) => ({ x: (x - board.view.x) * board.view.zoom, y: (y - board.view.y) * board.view.zoom });

  function eventPos(e) {
    const r = canvas.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  function resize() {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    requestDraw();
  }

  function zoomAt(z, sx, sy, save) {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    const w = toWorld(sx, sy);
    board.view.zoom = zoom;
    board.view.x = w.x - sx / zoom;
    board.view.y = w.y - sy / zoom;
    U.$('[data-zoom-label]', root).textContent = `${Math.round(zoom * 100)} %`;
    if (editing) positionEditor();
    if (save) scheduleSave();
    requestDraw();
  }

  function fitView() {
    const b = contentBounds();
    if (!b) return zoomAt(1, 0, 0, true);
    const pad = 60;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((canvas.clientWidth - pad * 2) / (b.w || 1), (canvas.clientHeight - pad * 2) / (b.h || 1), 2)));
    board.view.zoom = z;
    board.view.x = b.x - (canvas.clientWidth / z - b.w) / 2;
    board.view.y = b.y - (canvas.clientHeight / z - b.h) / 2;
    zoomAt(z, 0, 0, true);
  }

  function onWheel(e) {
    e.preventDefault();
    const { sx, sy } = eventPos(e);
    if (e.shiftKey) {
      board.view.x += e.deltaY / board.view.zoom;
      requestDraw();
      scheduleSave();
      return;
    }
    zoomAt(board.view.zoom * Math.exp(-e.deltaY * 0.0015), sx, sy, true);
  }

  // ---------- Géométrie ----------

  function textLines(item, width) {
    ctx.save();
    ctx.font = `${item.fontSize}px ${css('--font')}`;
    const out = [];
    for (const para of String(item.text || '').split('\n')) {
      if (!width) {
        out.push(para);
        continue;
      }
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const test = line + word;
        if (ctx.measureText(test).width > width && line.trim()) {
          out.push(line.trimEnd());
          line = word.trimStart();
        } else line = test;
      }
      out.push(line);
    }
    const widest = Math.max(0, ...out.map((l) => ctx.measureText(l).width));
    ctx.restore();
    return { lines: out, widest };
  }

  function bounds(i) {
    if (i.type === 'stroke') {
      let x1 = Infinity;
      let y1 = Infinity;
      let x2 = -Infinity;
      let y2 = -Infinity;
      for (const [x, y] of i.points) {
        x1 = Math.min(x1, x);
        y1 = Math.min(y1, y);
        x2 = Math.max(x2, x);
        y2 = Math.max(y2, y);
      }
      const p = i.size / 2;
      return { x: x1 - p, y: y1 - p, w: x2 - x1 + i.size, h: y2 - y1 + i.size };
    }
    if (i.type === 'line') {
      return { x: Math.min(i.x1, i.x2), y: Math.min(i.y1, i.y2), w: Math.abs(i.x2 - i.x1), h: Math.abs(i.y2 - i.y1) };
    }
    if (i.type === 'text') {
      const { lines, widest } = textLines(i, i.w);
      return { x: i.x, y: i.y, w: i.w || Math.max(20, widest), h: Math.max(1, lines.length) * i.fontSize * 1.3 };
    }
    if (i.type === 'note') {
      const { lines } = textLines(i, i.w - 28);
      return { x: i.x, y: i.y, w: i.w, h: Math.max(i.h, lines.length * i.fontSize * 1.3 + 28) };
    }
    return { x: Math.min(i.x, i.x + i.w), y: Math.min(i.y, i.y + i.h), w: Math.abs(i.w), h: Math.abs(i.h) };
  }

  function contentBounds() {
    if (!board.items.length) return null;
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const i of board.items) {
      const b = bounds(i);
      x1 = Math.min(x1, b.x);
      y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w);
      y2 = Math.max(y2, b.y + b.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function hit(i, x, y) {
    const tol = 6 / board.view.zoom;
    if (i.type === 'stroke') {
      const b = bounds(i);
      if (x < b.x - tol || x > b.x + b.w + tol || y < b.y - tol || y > b.y + b.h + tol) return false;
      const pts = i.points;
      if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= i.size / 2 + tol;
      for (let k = 1; k < pts.length; k++) {
        if (distToSegment(x, y, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]) <= i.size / 2 + tol) return true;
      }
      return false;
    }
    if (i.type === 'line') return distToSegment(x, y, i.x1, i.y1, i.x2, i.y2) <= i.size / 2 + tol;
    const b = bounds(i);
    return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
  }

  function itemAt(x, y) {
    for (let k = board.items.length - 1; k >= 0; k--) if (hit(board.items[k], x, y)) return board.items[k];
    return null;
  }

  // Poignées de redimensionnement de l'élément sélectionné (en coordonnées écran)
  function handlesOf(i) {
    if (i.type === 'line') {
      const a = toScreen(i.x1, i.y1);
      const b = toScreen(i.x2, i.y2);
      return [
        { id: 'p1', x: a.x, y: a.y },
        { id: 'p2', x: b.x, y: b.y },
      ];
    }
    const b = bounds(i);
    const tl = toScreen(b.x, b.y);
    const br = toScreen(b.x + b.w, b.y + b.h);
    if (i.type === 'text') return [{ id: 'e', x: br.x, y: (tl.y + br.y) / 2 }];
    return [
      { id: 'nw', x: tl.x, y: tl.y },
      { id: 'ne', x: br.x, y: tl.y },
      { id: 'sw', x: tl.x, y: br.y },
      { id: 'se', x: br.x, y: br.y },
    ];
  }

  function handleAt(sx, sy) {
    if (selection.size !== 1) return null;
    const item = board.items.find((i) => selection.has(i.id));
    if (!item) return null;
    const h = handlesOf(item).find((p) => Math.abs(p.x - sx) <= HANDLE && Math.abs(p.y - sy) <= HANDLE);
    return h ? { item, handle: h.id } : null;
  }

  // ---------- Modifications ----------

  function translate(i, dx, dy) {
    if (i.type === 'stroke') i.points = i.points.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
    else if (i.type === 'line') {
      i.x1 += dx;
      i.y1 += dy;
      i.x2 += dx;
      i.y2 += dy;
    } else {
      i.x += dx;
      i.y += dy;
    }
  }

  function applyResize(orig, item, handle, x, y, keepRatio) {
    if (item.type === 'line') {
      if (handle === 'p1') Object.assign(item, { x1: x, y1: y });
      else Object.assign(item, { x2: x, y2: y });
      return;
    }
    const b = bounds(orig);
    if (item.type === 'text') {
      item.w = Math.max(30, x - b.x);
      return;
    }
    // Coin opposé fixe
    const ax = handle.includes('w') ? b.x + b.w : b.x;
    const ay = handle.includes('n') ? b.y + b.h : b.y;
    let w = Math.max(8, Math.abs(x - ax));
    let h = Math.max(8, Math.abs(y - ay));
    if (keepRatio || item.type === 'stroke') {
      const s = Math.max(w / (b.w || 1), h / (b.h || 1));
      w = b.w * s;
      h = b.h * s;
    }
    const nx = handle.includes('w') ? ax - w : ax;
    const ny = handle.includes('n') ? ay - h : ay;
    if (item.type === 'stroke') {
      const sx = w / (b.w || 1);
      const sy = h / (b.h || 1);
      item.points = orig.points.map(([px, py]) => [r1(nx + (px - b.x) * sx), r1(ny + (py - b.y) * sy)]);
    } else {
      Object.assign(item, { x: nx, y: ny, w, h });
    }
  }

  function deleteSelection() {
    if (!selection.size) return;
    snapshot();
    board.items = board.items.filter((i) => !selection.has(i.id));
    selection.clear();
    changed();
  }

  function duplicate() {
    if (!selection.size) return;
    snapshot();
    const copies = board.items
      .filter((i) => selection.has(i.id))
      .map((i) => {
        const c = { ...structuredClone(i), id: uid() };
        translate(c, 20, 20);
        return c;
      });
    board.items.push(...copies);
    selection = new Set(copies.map((c) => c.id));
    changed();
  }

  function reorder(front) {
    snapshot();
    const sel = board.items.filter((i) => selection.has(i.id));
    const rest = board.items.filter((i) => !selection.has(i.id));
    board.items = front ? [...rest, ...sel] : [...sel, ...rest];
    changed();
  }

  // Gomme : retire les morceaux de traits qui passent sous le cercle
  function eraseAt(x, y, radius) {
    let touched = false;
    const next = [];
    for (const i of board.items) {
      if (i.type !== 'stroke') {
        next.push(i);
        continue;
      }
      const b = bounds(i);
      if (x + radius < b.x || x - radius > b.x + b.w || y + radius < b.y || y - radius > b.y + b.h) {
        next.push(i);
        continue;
      }
      const reach = radius + i.size / 2;
      let run = [];
      const runs = [];
      for (const p of i.points) {
        if (Math.hypot(p[0] - x, p[1] - y) <= reach) {
          if (run.length) runs.push(run);
          run = [];
          touched = true;
        } else run.push(p);
      }
      if (run.length) runs.push(run);
      if (runs.length === 1 && runs[0].length === i.points.length) {
        next.push(i);
        continue;
      }
      for (const r of runs) if (r.length > 1 || i.points.length === 1) next.push({ ...i, id: uid(), points: r });
    }
    if (touched) board.items = next;
    return touched;
  }

  // Ajoute des points intermédiaires pour que la gomme coupe proprement les traits
  function addPoint(points, x, y, step) {
    const last = points[points.length - 1];
    if (!last) {
      points.push([r1(x), r1(y)]);
      return;
    }
    const d = Math.hypot(x - last[0], y - last[1]);
    if (d < step * 0.5) return;
    const n = Math.max(1, Math.floor(d / step));
    for (let k = 1; k <= n; k++) points.push([r1(last[0] + ((x - last[0]) * k) / n), r1(last[1] + ((y - last[1]) * k) / n)]);
  }

  // ---------- Souris / stylet ----------

  function onPointerDown(e) {
    if (!board) return;
    commitEdit();
    canvas.setPointerCapture(e.pointerId);
    const { sx, sy } = eventPos(e);
    const w = toWorld(sx, sy);

    if (e.button === 1 || e.button === 2 || tool === 'hand' || spaceDown) {
      action = { type: 'pan', sx, sy, vx: board.view.x, vy: board.view.y };
      updateCursor();
      return;
    }
    if (e.button !== 0) return;

    if (tool === 'pen' || tool === 'marker') {
      const item = {
        id: uid(),
        type: 'stroke',
        points: [],
        color,
        size: sizes[tool],
        opacity: tool === 'marker' ? 0.35 : 1,
      };
      addPoint(item.points, w.x, w.y, 1);
      snapshot();
      board.items.push(item);
      action = { type: 'draw', item };
    } else if (tool === 'eraser') {
      const before = JSON.stringify(board.items);
      const touched = eraseAt(w.x, w.y, sizes.eraser / 2);
      action = { type: 'erase', last: w, before, snapshotKept: touched };
      if (touched) {
        undoStack.push(before);
        redoStack = [];
      }
    } else if (SHAPES.includes(tool)) {
      const item = { id: uid(), type: 'shape', shape: tool, x: w.x, y: w.y, w: 0, h: 0, color, fill, size: sizes.shape };
      snapshot();
      board.items.push(item);
      action = { type: 'create', item, ox: w.x, oy: w.y };
    } else if (tool === 'line' || tool === 'arrow') {
      const item = { id: uid(), type: 'line', x1: w.x, y1: w.y, x2: w.x, y2: w.y, color, size: sizes.shape, arrow: tool === 'arrow' };
      snapshot();
      board.items.push(item);
      action = { type: 'create', item, ox: w.x, oy: w.y };
    } else if (tool === 'text') {
      const existing = itemAt(w.x, w.y);
      if (existing && (existing.type === 'text' || existing.type === 'note')) {
        snapshot();
        return startEdit(existing);
      }
      snapshot();
      const item = { id: uid(), type: 'text', x: w.x, y: w.y - fontSize * 0.65, w: 0, text: '', color, fontSize };
      board.items.push(item);
      startEdit(item, true);
    } else if (tool === 'note') {
      snapshot();
      const item = { id: uid(), type: 'note', x: w.x - 100, y: w.y - 100, w: 200, h: 200, text: '', color: noteColor, fontSize: 20 };
      board.items.push(item);
      selection = new Set([item.id]);
      startEdit(item, true);
    } else if (tool === 'select') {
      const h = handleAt(sx, sy);
      if (h) {
        snapshot();
        action = { type: 'resize', item: h.item, handle: h.handle, orig: structuredClone(h.item) };
        return;
      }
      const target = itemAt(w.x, w.y);
      if (target) {
        if (e.shiftKey) {
          if (selection.has(target.id)) selection.delete(target.id);
          else selection.add(target.id);
        } else if (!selection.has(target.id)) selection = new Set([target.id]);
        action = { type: 'move', last: w, moved: false };
      } else {
        if (!e.shiftKey) selection.clear();
        action = { type: 'marquee', ox: w.x, oy: w.y, x: w.x, y: w.y, base: new Set(selection) };
      }
      renderProps();
    }
    requestDraw();
  }

  function onPointerMove(e) {
    if (!board) return;
    const { sx, sy } = eventPos(e);
    const w = toWorld(sx, sy);
    pointer = { sx, sy };

    if (!action) {
      if (tool === 'select') {
        const h = handleAt(sx, sy);
        canvas.style.cursor = h ? (h.handle === 'e' ? 'ew-resize' : h.handle.startsWith('p') ? 'move' : ['nw', 'se'].includes(h.handle) ? 'nwse-resize' : 'nesw-resize') : itemAt(w.x, w.y) ? 'move' : 'default';
      }
      if (['pen', 'marker', 'eraser'].includes(tool)) requestDraw();
      return;
    }

    if (action.type === 'pan') {
      board.view.x = action.vx - (sx - action.sx) / board.view.zoom;
      board.view.y = action.vy - (sy - action.sy) / board.view.zoom;
      if (editing) positionEditor();
    } else if (action.type === 'draw') {
      // Points intermédiaires du stylet pour un tracé plus fluide
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const p = eventPos(ev);
        const pw = toWorld(p.sx, p.sy);
        addPoint(action.item.points, pw.x, pw.y, Math.max(1, action.item.size / 4));
      }
    } else if (action.type === 'erase') {
      const r = sizes.eraser / 2;
      const d = Math.hypot(w.x - action.last.x, w.y - action.last.y);
      const n = Math.max(1, Math.ceil(d / (r / 2)));
      for (let k = 1; k <= n; k++) {
        if (eraseAt(action.last.x + ((w.x - action.last.x) * k) / n, action.last.y + ((w.y - action.last.y) * k) / n, r) && !action.snapshotKept) {
          action.snapshotKept = true;
          undoStack.push(action.before);
          redoStack = [];
        }
      }
      action.last = w;
    } else if (action.type === 'create') {
      const it = action.item;
      if (it.type === 'line') {
        let { x, y } = w;
        if (e.shiftKey) {
          // Angles par pas de 45°
          const ang = Math.round(Math.atan2(y - action.oy, x - action.ox) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(x - action.ox, y - action.oy);
          x = action.ox + Math.cos(ang) * len;
          y = action.oy + Math.sin(ang) * len;
        }
        it.x2 = x;
        it.y2 = y;
      } else {
        let dx = w.x - action.ox;
        let dy = w.y - action.oy;
        if (e.shiftKey) {
          const m = Math.max(Math.abs(dx), Math.abs(dy));
          dx = Math.sign(dx || 1) * m;
          dy = Math.sign(dy || 1) * m;
        }
        it.x = Math.min(action.ox, action.ox + dx);
        it.y = Math.min(action.oy, action.oy + dy);
        it.w = Math.abs(dx);
        it.h = Math.abs(dy);
      }
    } else if (action.type === 'move') {
      const dx = w.x - action.last.x;
      const dy = w.y - action.last.y;
      if (!action.moved) {
        if (Math.hypot(dx, dy) * board.view.zoom < 3) return;
        snapshot();
        action.moved = true;
      }
      for (const i of board.items) if (selection.has(i.id)) translate(i, dx, dy);
      action.last = w;
    } else if (action.type === 'resize') {
      applyResize(action.orig, action.item, action.handle, w.x, w.y, e.shiftKey);
    } else if (action.type === 'marquee') {
      action.x = w.x;
      action.y = w.y;
      const x1 = Math.min(action.ox, w.x);
      const y1 = Math.min(action.oy, w.y);
      const x2 = Math.max(action.ox, w.x);
      const y2 = Math.max(action.oy, w.y);
      selection = new Set(action.base);
      for (const i of board.items) {
        const b = bounds(i);
        if (b.x >= x1 && b.y >= y1 && b.x + b.w <= x2 && b.y + b.h <= y2) selection.add(i.id);
      }
    }
    requestDraw();
  }

  function onPointerUp() {
    if (!action) return;
    const a = action;
    action = null;
    updateCursor();

    if (a.type === 'pan') return scheduleSave();
    if (a.type === 'create') {
      const it = a.item;
      // Simple clic : forme de taille par défaut
      if (it.type === 'shape' && it.w < 4 && it.h < 4) Object.assign(it, { x: a.ox - 60, y: a.oy - 40, w: 120, h: 80 });
      if (it.type === 'line' && Math.hypot(it.x2 - it.x1, it.y2 - it.y1) < 4) Object.assign(it, { x2: it.x1 + 120 });
    }
    if (a.type === 'erase' && !a.snapshotKept) return requestDraw();
    if (a.type === 'move' && !a.moved) return renderProps();
    if (a.type === 'marquee') {
      renderProps();
      return requestDraw();
    }
    changed();
  }

  function onDoubleClick(e) {
    const { sx, sy } = eventPos(e);
    const w = toWorld(sx, sy);
    const target = itemAt(w.x, w.y);
    if (target && (target.type === 'text' || target.type === 'note')) {
      snapshot();
      startEdit(target);
    } else if (tool === 'select' && !target) {
      snapshot();
      const item = { id: uid(), type: 'text', x: w.x, y: w.y - fontSize * 0.65, w: 0, text: '', color, fontSize };
      board.items.push(item);
      startEdit(item, true);
    }
  }

  // ---------- Édition de texte ----------

  function startEdit(item, isNew = false) {
    commitEdit();
    const ta = U.h('<textarea class="board-editor" spellcheck="true"></textarea>');
    ta.value = item.text || '';
    canvas.parentElement.appendChild(ta);
    editing = { item, ta, isNew };
    positionEditor();
    ta.addEventListener('input', () => {
      item.text = ta.value;
      positionEditor();
      requestDraw();
    });
    ta.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape' || (ev.key === 'Enter' && ev.ctrlKey)) commitEdit();
    });
    ta.addEventListener('blur', () =>
      setTimeout(() => {
        if (editing?.ta === ta) commitEdit();
      }, 0),
    );
    setTimeout(() => ta.focus(), 0);
    requestDraw();
  }

  function positionEditor() {
    if (!editing) return;
    const { item, ta } = editing;
    const z = board.view.zoom;
    const b = bounds(item);
    const p = toScreen(item.x, item.y);
    const pad = item.type === 'note' ? 14 * z : 0;
    Object.assign(ta.style, {
      left: `${p.x + pad}px`,
      top: `${p.y + pad}px`,
      width: `${Math.max(item.type === 'note' ? b.w * z - pad * 2 : Math.max(b.w, 200) * z, 60)}px`,
      height: `${Math.max(b.h * z - pad * 2, item.fontSize * 1.4 * z)}px`,
      fontSize: `${item.fontSize * z}px`,
      lineHeight: `${item.fontSize * 1.3 * z}px`,
      color: item.type === 'note' ? '#1d1f2b' : paint(item.color),
      textAlign: item.type === 'note' ? 'center' : 'left',
    });
  }

  function commitEdit() {
    if (!editing) return;
    const { item, ta, isNew } = editing;
    editing = null;
    ta.remove();
    item.text = ta.value.replace(/\s+$/, '');
    if (item.type === 'text' && !item.text.trim()) {
      board.items = board.items.filter((i) => i.id !== item.id);
      if (isNew) undoStack.pop();
    }
    changed();
  }

  // ---------- Clavier et collage ----------

  function onKeyDown(e) {
    if (App.view !== 'brainstorm' || !board || Modal.isOpen()) return;
    if (e.target.closest('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') {
      spaceDown = true;
      updateCursor();
      e.preventDefault();
      return;
    }
    if (e.ctrlKey && k === 'z' && !e.shiftKey) return e.preventDefault(), undo();
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) return e.preventDefault(), redo();
    if (e.ctrlKey && k === 'd') return e.preventDefault(), duplicate();
    if (e.ctrlKey && k === 'a') {
      e.preventDefault();
      setTool('select');
      selection = new Set(board.items.map((i) => i.id));
      renderProps();
      return requestDraw();
    }
    if (e.ctrlKey && k === '0') return zoomAt(1, canvas.clientWidth / 2, canvas.clientHeight / 2, true);
    if (k === 'delete' || k === 'backspace') return deleteSelection();
    if (k === 'escape') {
      selection.clear();
      renderProps();
      return requestDraw();
    }
    if (k === '[' || k === ']') {
      const key = ['pen', 'marker', 'eraser'].includes(tool) ? tool : 'shape';
      sizes[key] = Math.max(1, Math.min(120, Math.round(sizes[key] * (k === ']' ? 1.25 : 0.8)) + (k === ']' ? 1 : 0)));
      renderProps();
      return requestDraw();
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const t = TOOLS.find((x) => x.key.toLowerCase() === k);
    if (t) setTool(t.id);
  }

  // Coller du texte : crée une zone de texte au centre de l'écran
  function onPaste(e) {
    if (App.view !== 'brainstorm' || !board || editing || e.target.closest('input, textarea')) return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    snapshot();
    const c = toWorld(canvas.clientWidth / 2, canvas.clientHeight / 2);
    board.items.push({ id: uid(), type: 'text', x: c.x, y: c.y, w: Math.min(500, text.length * 9), text, color, fontSize: 20 });
    changed();
  }

  // ---------- Dessin ----------

  function requestDraw() {
    if (frame || !ctx) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  }

  function drawBackground(c, w, h, view) {
    c.fillStyle = css('--board-bg') || css('--surface');
    c.fillRect(0, 0, w, h);
    // Grille de points qui suit le zoom
    let step = 24 * view.zoom;
    while (step < 12) step *= 2;
    const ox = -((view.x * view.zoom) % step);
    const oy = -((view.y * view.zoom) % step);
    c.fillStyle = css('--board-dot') || css('--border');
    const r = Math.max(0.8, Math.min(1.6, view.zoom));
    for (let x = ox; x < w; x += step) for (let y = oy; y < h; y += step) c.fillRect(x - r / 2, y - r / 2, r, r);
  }

  function drawItem(c, i) {
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (i.type === 'stroke') {
      const pts = i.points;
      c.globalAlpha = i.opacity ?? 1;
      c.strokeStyle = c.fillStyle = paint(i.color);
      c.lineWidth = i.size;
      if (pts.length === 1) {
        c.beginPath();
        c.arc(pts[0][0], pts[0][1], i.size / 2, 0, Math.PI * 2);
        c.fill();
      } else {
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        // Courbes passant par le milieu des segments : tracé lissé
        for (let k = 1; k < pts.length - 1; k++) {
          c.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
        }
        c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        c.stroke();
      }
    } else if (i.type === 'shape') {
      const col = paint(i.color);
      c.strokeStyle = col;
      c.lineWidth = i.size;
      c.beginPath();
      const { x, y, w, h } = i;
      if (i.shape === 'rect') c.roundRect(x, y, w, h, Math.min(10, w / 4, h / 4));
      else if (i.shape === 'ellipse') c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else if (i.shape === 'triangle') {
        c.moveTo(x + w / 2, y);
        c.lineTo(x + w, y + h);
        c.lineTo(x, y + h);
        c.closePath();
      } else if (i.shape === 'diamond') {
        c.moveTo(x + w / 2, y);
        c.lineTo(x + w, y + h / 2);
        c.lineTo(x + w / 2, y + h);
        c.lineTo(x, y + h / 2);
        c.closePath();
      }
      if (i.fill) {
        c.globalAlpha = 0.22;
        c.fillStyle = col;
        c.fill();
        c.globalAlpha = 1;
      }
      c.stroke();
    } else if (i.type === 'line') {
      c.strokeStyle = c.fillStyle = paint(i.color);
      c.lineWidth = i.size;
      c.beginPath();
      c.moveTo(i.x1, i.y1);
      c.lineTo(i.x2, i.y2);
      c.stroke();
      if (i.arrow) {
        const ang = Math.atan2(i.y2 - i.y1, i.x2 - i.x1);
        const len = Math.max(12, i.size * 4);
        c.beginPath();
        c.moveTo(i.x2, i.y2);
        c.lineTo(i.x2 - len * Math.cos(ang - 0.45), i.y2 - len * Math.sin(ang - 0.45));
        c.lineTo(i.x2 - len * Math.cos(ang + 0.45), i.y2 - len * Math.sin(ang + 0.45));
        c.closePath();
        c.fill();
      }
    } else if (i.type === 'text' || i.type === 'note') {
      const b = bounds(i);
      if (i.type === 'note') {
        c.shadowColor = 'rgba(0,0,0,0.18)';
        c.shadowBlur = 10;
        c.shadowOffsetY = 3;
        c.fillStyle = i.color;
        c.fillRect(b.x, b.y, b.w, b.h);
        c.shadowColor = 'transparent';
      }
      if (editing?.item === i) return c.restore();
      c.font = `${i.fontSize}px ${css('--font')}`;
      c.fillStyle = i.type === 'note' ? '#1d1f2b' : paint(i.color);
      c.textBaseline = 'top';
      const lh = i.fontSize * 1.3;
      if (i.type === 'note') {
        const { lines } = textLines(i, i.w - 28);
        c.textAlign = 'center';
        const top = b.y + Math.max(14, (b.h - lines.length * lh) / 2);
        lines.forEach((l, k) => c.fillText(l, b.x + b.w / 2, top + k * lh));
      } else {
        textLines(i, i.w).lines.forEach((l, k) => c.fillText(l, i.x, i.y + k * lh + i.fontSize * 0.12));
      }
    }
    c.restore();
  }

  function draw() {
    if (!board || !canvas) return;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const v = board.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(ctx, w, h, v);

    ctx.save();
    ctx.scale(v.zoom, v.zoom);
    ctx.translate(-v.x, -v.y);
    for (const i of board.items) drawItem(ctx, i);
    ctx.restore();

    // Sélection
    const accent = css('--accent');
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    for (const i of board.items) {
      if (!selection.has(i.id)) continue;
      const b = bounds(i);
      const p = toScreen(b.x, b.y);
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(p.x - 4, p.y - 4, b.w * v.zoom + 8, b.h * v.zoom + 8);
      ctx.setLineDash([]);
    }
    if (selection.size === 1 && tool === 'select') {
      const item = board.items.find((i) => selection.has(i.id));
      if (item) {
        for (const hd of handlesOf(item)) {
          ctx.fillStyle = css('--surface');
          ctx.fillRect(hd.x - HANDLE / 2, hd.y - HANDLE / 2, HANDLE, HANDLE);
          ctx.strokeRect(hd.x - HANDLE / 2, hd.y - HANDLE / 2, HANDLE, HANDLE);
        }
      }
    }
    if (action?.type === 'marquee') {
      const a = toScreen(action.ox, action.oy);
      const b = toScreen(action.x, action.y);
      ctx.fillStyle = `${accent}22`;
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }

    // Curseur rond à la taille du crayon / de la gomme
    if (pointer && ['pen', 'marker', 'eraser'].includes(tool) && !spaceDown) {
      const r = Math.max(2, (sizes[tool] * v.zoom) / 2);
      ctx.beginPath();
      ctx.arc(pointer.sx, pointer.sy, r, 0, Math.PI * 2);
      if (tool === 'eraser') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
        ctx.strokeStyle = ink();
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.globalAlpha = tool === 'marker' ? 0.35 : 0.85;
        ctx.fillStyle = paint(color);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = css('--surface');
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    U.$('[data-zoom-label]', root).textContent = `${Math.round(v.zoom * 100)} %`;
    U.$('[data-undo]', root).disabled = !undoStack.length;
    U.$('[data-redo]', root).disabled = !redoStack.length;
  }

  // Image PNG de toute la feuille (ou de la zone visible si elle est vide)
  function exportImage() {
    commitEdit();
    const b = contentBounds() || { ...toWorld(0, 0), w: canvas.clientWidth / board.view.zoom, h: canvas.clientHeight / board.view.zoom };
    const pad = 40;
    const scale = Math.min(2, 8000 / Math.max(b.w + pad * 2, b.h + pad * 2));
    const out = document.createElement('canvas');
    out.width = Math.ceil((b.w + pad * 2) * scale);
    out.height = Math.ceil((b.h + pad * 2) * scale);
    const c = out.getContext('2d');
    const view = { x: b.x - pad, y: b.y - pad, zoom: scale };
    drawBackground(c, out.width, out.height, view);
    c.scale(scale, scale);
    c.translate(-view.x, -view.y);
    const keep = selection;
    selection = new Set();
    for (const i of board.items) drawItem(c, i);
    selection = keep;
    return out.toDataURL('image/png');
  }

  return { init, render, flush: flushSave };
})();
