// Construit l'appli téléphone (appli web installable) dans dist-web/ à partir du code du PC.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist-web');
const { version } = require('../package.json');

function copy(from, to) {
  const target = path.join(OUT, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), target);
}

function copyDir(from, to, filter = () => true) {
  for (const name of fs.readdirSync(path.join(ROOT, from))) {
    if (filter(name)) copy(path.join(from, name), path.join(to, name));
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

copyDir('src/renderer/css', 'css', (n) => n !== 'small-windows.css');
copyDir('src/renderer/js', 'js', (n) => !['popup.js', 'widget.js', 'quickadd.js'].includes(n));
copyDir('src/shared', 'shared');
copy('src/main/scheduler.js', 'engine/scheduler.js');
copy('src/main/pomodoro.js', 'engine/pomodoro.js');
copy('node_modules/chart.js/dist/chart.umd.js', 'vendor/chart.umd.js');
for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) copy(`src/assets/${icon}`, `assets/${icon}`);
fs.mkdirSync(path.join(OUT, 'web'), { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'web/api-web.js'),
  fs.readFileSync(path.join(ROOT, 'src/web/api-web.js'), 'utf8').replace("'__VERSION__'", JSON.stringify(version)),
);

// Page principale : mêmes vues que sur PC, avec l'interface « api » du navigateur à la place d'Electron
let html = fs.readFileSync(path.join(ROOT, 'src/renderer/index.html'), 'utf8');
html = html
  .replace('<meta charset="utf-8" />', `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#6c4ff6" />
    <link rel="manifest" href="manifest.webmanifest" />
    <link rel="icon" href="assets/icon-192.png" />
    <link rel="apple-touch-icon" href="assets/icon-192.png" />`)
  .replace(/\.\.\/shared\//g, 'shared/')
  .replace('../../node_modules/chart.js/dist/chart.umd.js', 'vendor/chart.umd.js')
  .replace(
    '<script src="js/common.js"></script>',
    `<script src="shared/data.js"></script>
    <script src="engine/scheduler.js"></script>
    <script src="engine/pomodoro.js"></script>
    <script src="js/common.js"></script>
    <script src="js/popup-content.js"></script>
    <script src="web/api-web.js"></script>`,
  );
for (const needed of ['shared/schedule.js', 'shared/sync.js', 'vendor/chart.umd.js', 'web/api-web.js', 'manifest.webmanifest']) {
  if (!html.includes(needed)) throw new Error(`index.html : ${needed} manquant`);
}
fs.writeFileSync(path.join(OUT, 'index.html'), html);

fs.writeFileSync(
  path.join(OUT, 'manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'Mon Planning',
      short_name: 'Mon Planning',
      description: 'Emploi du temps, to-do list, récapitulatif et brainstorming',
      lang: 'fr',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'any',
      background_color: '#f4f5fb',
      theme_color: '#6c4ff6',
      icons: [
        { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ),
);

// Le service worker met en cache tous les fichiers ; son contenu change à chaque version, ce qui déclenche la mise à jour
const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else files.push(path.relative(OUT, full).split(path.sep).join('/'));
  }
})(OUT);
const hash = crypto.createHash('sha256');
for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
const cacheVersion = `${version}-${hash.digest('hex').slice(0, 10)}`;
const sw = fs
  .readFileSync(path.join(ROOT, 'src/web/sw.js'), 'utf8')
  .replace("'mon-planning-__VERSION__'", JSON.stringify(`mon-planning-${cacheVersion}`))
  .replace('= __FILES__;', `= ${JSON.stringify(['./', ...files], null, 2)};`);
// Un fichier généré invalide ne doit jamais être publié
new vm.Script(sw, { filename: 'sw.js' });
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
// GitHub Pages : servir les fichiers tels quels
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log(`Appli téléphone construite dans dist-web/ (version ${cacheVersion}, ${files.length} fichiers)`);
