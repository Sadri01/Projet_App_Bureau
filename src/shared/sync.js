// Synchronisation entre appareils par code à copier-coller.
// Le code contient les données compressées ; à l'import, elles sont fusionnées :
// pour chaque élément, la modification la plus récente gagne, et les suppressions sont respectées.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PREFIX = 'MP1.';
  const FORMAT = 'mon-planning-sync';
  const COLLECTIONS = ['activities', 'tasks', 'categories', 'boards'];
  const LABELS = {
    activities: ['activité', 'activités'],
    tasks: ['tâche', 'tâches'],
    categories: ['catégorie', 'catégories'],
    boards: ['feuille de brainstorming', 'feuilles de brainstorming'],
  };
  // Les traces de suppression plus vieilles que ça sont oubliées
  const TOMBSTONE_DAYS = 120;

  // Données à envoyer à l'autre appareil (les réglages restent propres à chaque appareil)
  function payload(data, { includeBoards = true } = {}) {
    const out = {
      format: FORMAT,
      v: 1,
      exportedAt: new Date().toISOString(),
      activities: data.activities,
      tasks: data.tasks,
      categories: data.categories,
      log: data.log,
      logUpdated: data.logUpdated || {},
      deleted: data.deleted || {},
      hasFeeds: (data.settings?.icsFeeds || []).length > 0,
      importedEvents: data.importedEvents || [],
    };
    if (includeBoards) out.boards = data.boards || [];
    return out;
  }

  function mergeCollection(name, local, incoming, deleted, summary) {
    const result = [];
    const incById = new Map(incoming.map((i) => [i.id, i]));
    const seen = new Set();
    const consider = (l, r) => {
      const id = (l || r).id;
      seen.add(id);
      let chosen = l || r;
      if (l && r && (r.updatedAt || '') > (l.updatedAt || '')) chosen = r;
      const tomb = deleted[`${name}:${id}`];
      if (tomb && tomb >= (chosen.updatedAt || '')) {
        if (l) summary.removed[name] = (summary.removed[name] || 0) + 1;
        return;
      }
      if (!l) summary.added[name] = (summary.added[name] || 0) + 1;
      else if (chosen === r && JSON.stringify(l) !== JSON.stringify(r)) summary.updated[name] = (summary.updated[name] || 0) + 1;
      result.push(chosen);
    };
    for (const l of local) consider(l, incById.get(l.id));
    for (const r of incoming) if (!seen.has(r.id)) consider(null, r);
    return result;
  }

  // Fusionne les données reçues dans les données locales. Ne modifie pas `local`.
  function merge(local, incoming) {
    if (!incoming || incoming.format !== FORMAT) throw new Error("Ce code ne vient pas de Mon Planning.");
    const summary = { added: {}, updated: {}, removed: {}, log: 0 };
    const out = { ...local };

    // Traces de suppression des deux côtés, en gardant la plus récente
    const deleted = { ...(local.deleted || {}) };
    for (const [k, t] of Object.entries(incoming.deleted || {})) if (!deleted[k] || t > deleted[k]) deleted[k] = t;
    const limit = new Date(Date.now() - TOMBSTONE_DAYS * 86400000).toISOString();
    for (const [k, t] of Object.entries(deleted)) if (t < limit) delete deleted[k];
    out.deleted = deleted;

    for (const name of COLLECTIONS) {
      if (!Array.isArray(incoming[name])) continue;
      out[name] = mergeCollection(name, local[name] || [], incoming[name], deleted, summary);
    }

    // Séances faites / passées
    const log = { ...(local.log || {}) };
    const logUpdated = { ...(local.logUpdated || {}) };
    const inLog = incoming.log || {};
    const inUpdated = incoming.logUpdated || {};
    for (const key of new Set([...Object.keys(inLog), ...Object.keys(inUpdated)])) {
      const tl = logUpdated[key] || '';
      const tr = inUpdated[key] || '';
      const takeIncoming = tr > tl || (!tl && !tr && !(key in log));
      if (!takeIncoming) continue;
      if (log[key] !== inLog[key]) summary.log += 1;
      if (inLog[key]) log[key] = inLog[key];
      else delete log[key];
      if (tr) logUpdated[key] = tr;
    }
    out.log = log;
    out.logUpdated = logUpdated;

    // Agendas importés : le téléphone ne peut pas les télécharger, il reprend ceux du PC
    const localHasFeeds = (local.settings?.icsFeeds || []).length > 0;
    if (!localHasFeeds && incoming.hasFeeds) out.importedEvents = incoming.importedEvents || [];

    return { data: out, summary };
  }

  function describe(summary) {
    const count = (name, n) => `${n} ${LABELS[name][n > 1 ? 1 : 0]}`;
    const parts = [];
    for (const [kind, title] of [
      ['added', 'Ajouté'],
      ['updated', 'Mis à jour'],
      ['removed', 'Supprimé'],
    ]) {
      const items = Object.entries(summary[kind]).map(([name, n]) => count(name, n));
      if (items.length) parts.push(`${title} : ${items.join(', ')}`);
    }
    if (summary.log) parts.push(`${summary.log} séance${summary.log > 1 ? 's' : ''} cochée${summary.log > 1 ? 's' : ''}`);
    return parts.length ? parts.join(' · ') : 'Rien de nouveau : les deux appareils étaient déjà à jour.';
  }

  // ---------- Code texte : JSON compressé (gzip) puis base64 « URL » ----------

  function toBase64Url(bytes) {
    let b64;
    if (typeof Buffer !== 'undefined') b64 = Buffer.from(bytes).toString('base64');
    else {
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      b64 = btoa(bin);
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function pipe(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }

  async function encode(obj) {
    const json = new TextEncoder().encode(JSON.stringify(obj));
    return PREFIX + toBase64Url(await pipe(json, new CompressionStream('gzip')));
  }

  async function decode(code) {
    // Tolère les espaces et retours à la ligne ajoutés par les messageries
    const clean = String(code || '').replace(/\s+/g, '');
    if (!clean.startsWith(PREFIX)) throw new Error('Code invalide : il doit commencer par « MP1. ».');
    let bytes;
    try {
      bytes = await pipe(fromBase64Url(clean.slice(PREFIX.length)), new DecompressionStream('gzip'));
    } catch {
      throw new Error('Code incomplet ou abîmé : vérifie que tout le code a bien été copié.');
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  return { payload, merge, describe, encode, decode, PREFIX };
});
