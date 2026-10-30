// Sons de notification générés à la volée (aucun fichier audio nécessaire).
const Sounds = (() => {
  const LIST = {
    carillon: 'Carillon',
    cloche: 'Cloche douce',
    bip: 'Bip bip',
    marimba: 'Marimba',
    talkie: 'Talkie-walkie',
    custom: 'Mon propre son',
    aucun: 'Aucun son',
  };

  let ctx = null;
  const audio = () => (ctx ||= new AudioContext());

  function tone(c, out, { freq, start, dur, type = 'sine', gain = 0.3, attack = 0.01 }) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function noise(c, out, { start, dur, gain = 0.15 }) {
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(out);
    src.start(start);
  }

  const PATTERNS = {
    carillon(c, out, t) {
      [659.25, 783.99, 1046.5].forEach((f, i) => tone(c, out, { freq: f, start: t + i * 0.16, dur: 1.1 }));
    },
    cloche(c, out, t) {
      for (const [ratio, g] of [[1, 0.35], [2.76, 0.12], [5.4, 0.06]]) {
        tone(c, out, { freq: 523.25 * ratio, start: t, dur: 2.2, gain: g, attack: 0.005 });
        tone(c, out, { freq: 659.25 * ratio, start: t + 0.6, dur: 2.2, gain: g, attack: 0.005 });
      }
    },
    bip(c, out, t) {
      [0, 0.18, 0.6, 0.78].forEach((d) => tone(c, out, { freq: 1320, start: t + d, dur: 0.12, type: 'square', gain: 0.12 }));
    },
    marimba(c, out, t) {
      [523.25, 659.25, 587.33, 783.99].forEach((f, i) =>
        tone(c, out, { freq: f, start: t + i * 0.13, dur: 0.45, type: 'triangle', gain: 0.4, attack: 0.003 }),
      );
    },
    talkie(c, out, t) {
      noise(c, out, { start: t, dur: 0.25, gain: 0.25 });
      tone(c, out, { freq: 880, start: t + 0.28, dur: 0.18, type: 'square', gain: 0.08 });
      tone(c, out, { freq: 660, start: t + 0.5, dur: 0.25, type: 'square', gain: 0.08 });
      noise(c, out, { start: t + 0.8, dur: 0.15, gain: 0.18 });
    },
  };

  let customAudio = null;

  // settings : { sound, volume } ; readCustom : fonction async qui renvoie le son perso
  async function play(settings, readCustom) {
    const name = settings.sound;
    const volume = Math.max(0, Math.min(1, Number(settings.volume ?? 0.7)));
    if (name === 'aucun' || volume === 0) return;
    if (name === 'custom' && readCustom) {
      const url = await readCustom();
      if (url) {
        customAudio?.pause();
        customAudio = new Audio(url);
        customAudio.volume = volume;
        await customAudio.play().catch(() => {});
        return;
      }
    }
    const c = audio();
    if (c.state === 'suspended') await c.resume();
    const out = c.createGain();
    out.gain.value = volume;
    out.connect(c.destination);
    (PATTERNS[name] || PATTERNS.carillon)(c, out, c.currentTime + 0.05);
  }

  return { LIST, play };
})();
