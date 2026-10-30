// Import d'agendas externes au format iCalendar (.ics) : Google Agenda, Outlook, fichier...
const ical = require('node-ical');

const PAST_DAYS = 30;
const FUTURE_DAYS = 180;

function toEvents(parsed, feed) {
  const from = new Date(Date.now() - PAST_DAYS * 86400000);
  const to = new Date(Date.now() + FUTURE_DAYS * 86400000);
  const out = [];
  for (const item of Object.values(parsed)) {
    if (!item || item.type !== 'VEVENT' || !item.start) continue;
    let instances;
    try {
      instances = ical.expandRecurringEvent(item, { from, to });
    } catch {
      instances = [{ summary: item.summary, start: item.start, end: item.end, isFullDay: item.datetype === 'date' }];
    }
    for (const inst of instances) {
      const start = new Date(inst.start);
      if (start < from || start > to) continue;
      const end = inst.end ? new Date(inst.end) : new Date(start.getTime() + 3600000);
      const summary = typeof inst.summary === 'object' ? inst.summary?.val : inst.summary;
      out.push({
        uid: `${feed.id}|${item.uid || summary}|${start.toISOString()}`,
        feedId: feed.id,
        title: summary || '(sans titre)',
        color: feed.color,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: Boolean(inst.isFullDay),
        location: typeof item.location === 'string' ? item.location : '',
      });
    }
  }
  return out;
}

async function fetchFeed(feed) {
  const url = feed.url.replace(/^webcal:\/\//i, 'https://');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  const text = await res.text();
  return toEvents(ical.sync.parseICS(text), feed);
}

function parseFile(text, feed) {
  return toEvents(ical.sync.parseICS(text), feed);
}

module.exports = { fetchFeed, parseFile };
