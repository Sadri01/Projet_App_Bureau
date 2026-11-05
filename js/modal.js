// Fenêtres modales (formulaires d'édition, confirmations).
const Modal = (() => {
  let current = null;

  function close() {
    if (!current) return;
    current.remove();
    document.removeEventListener('keydown', onKey);
    current = null;
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  // actions : [{ label, kind: 'primary'|'danger'|'', onClick: () => bool|void, left: bool }]
  function open({ title, body, actions = [] }) {
    close();
    const backdrop = U.h(`<div class="modal-backdrop">
      <div class="modal card" role="dialog" aria-modal="true">
        <h2>${U.esc(title)}</h2>
        <div class="modal-body"></div>
        <div class="modal-actions"></div>
      </div>
    </div>`);
    const bodyEl = U.$('.modal-body', backdrop);
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);

    const actionsEl = U.$('.modal-actions', backdrop);
    for (const a of actions) {
      const btn = U.h(`<button class="btn ${a.kind || ''}">${U.esc(a.label)}</button>`);
      if (a.left) btn.style.marginRight = 'auto';
      btn.addEventListener('click', async () => {
        const keepOpen = a.onClick ? await a.onClick() : false;
        if (keepOpen !== true) close();
      });
      actionsEl.appendChild(btn);
    }
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    current = backdrop;
    U.$('input, textarea, select', bodyEl)?.focus();
    return { root: bodyEl, close };
  }

  function confirm(title, message, label = 'Supprimer') {
    return new Promise((resolve) => {
      open({
        title,
        body: `<p>${U.esc(message)}</p>`,
        actions: [
          { label: 'Annuler', onClick: () => resolve(false) },
          { label, kind: 'primary', onClick: () => resolve(true) },
        ],
      });
    });
  }

  return { open, close, confirm, isOpen: () => Boolean(current) };
})();
