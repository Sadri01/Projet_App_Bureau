// Service worker : l'appli fonctionne sans Internet et se met à jour quand une nouvelle version est publiée.
// La version et la liste des fichiers sont remplies par scripts/build-web.js.
const CACHE = "mon-planning-0.3.0-79b29963da";
const FILES = [
  "./",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png",
  "css/app.css",
  "css/popup.css",
  "css/themes.css",
  "engine/pomodoro.js",
  "engine/scheduler.js",
  "index.html",
  "js/activity-form.js",
  "js/agenda.js",
  "js/app.js",
  "js/brainstorm.js",
  "js/common.js",
  "js/modal.js",
  "js/pomodoro.js",
  "js/popup-content.js",
  "js/settings.js",
  "js/sounds.js",
  "js/stats.js",
  "js/todo.js",
  "manifest.webmanifest",
  "shared/data.js",
  "shared/schedule.js",
  "shared/sync.js",
  "vendor/chart.umd.js",
  "web/api-web.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mon-planning-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// La page demande d'activer la nouvelle version (bouton « Recharger »)
self.addEventListener('message', (event) => {
  if (event.data === 'activer') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)));
});

// Toucher une notification ouvre l'appli
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    }),
  );
});
