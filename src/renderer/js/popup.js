// Pop-up de rappel affiché au premier plan avec un son.
(async () => {
  let state = await api.getState();
  U.applyTheme(state.settings.theme);
  api.onState((s) => {
    state = s;
    U.applyTheme(s.settings.theme);
  });

  const root = U.$('#root');

  api.onPopup((p) => {
    root.innerHTML = PopupContent.html(p);
    U.$$('[data-a]', root).forEach((b) => (b.onclick = () => api.popupAction(b.dataset.a)));
    if (p.kind !== 'update') Sounds.play(state.settings, api.readSound);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') api.popupAction('dismiss');
  });
})();
