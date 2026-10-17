/* Plucked-string synth (Karplus-Strong) on Web Audio. */
const Sound = (() => {
  let ctx = null, master = null;
  const cache = new Map();

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function buffer(midi) {
    if (cache.has(midi)) return cache.get(midi);
    const sr = ctx.sampleRate;
    const N = Math.max(2, Math.round(sr / Theory.freq(midi)));
    const len = Math.floor(sr * 2.2);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const ring = new Float32Array(N);
    let seed = midi * 9973 + 1;
    for (let i = 0; i < N; i++) { seed = (seed * 16807) % 2147483647; ring[i] = (seed / 2147483647) * 2 - 1; }
    for (let k = 0; k < 2; k++) for (let i = 0; i < N; i++) ring[i] = (ring[i] + ring[(i + 1) % N]) / 2;
    let p = 0, max = 0;
    for (let i = 0; i < len; i++) {
      const nx = (p + 1) % N;
      d[i] = ring[p];
      ring[p] = (ring[p] + ring[nx]) * 0.5 * 0.9968;
      p = nx;
      if (Math.abs(d[i]) > max) max = Math.abs(d[i]);
    }
    const g = 0.6 / (max || 1), fade = 3000;
    for (let i = 0; i < len; i++) d[i] *= g * (i > len - fade ? (len - i) / fade : 1);
    cache.set(midi, buf);
    return buf;
  }

  function pluck(midi, delay = 0, gain = 1) {
    if (!init()) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer(midi);
    const g = ctx.createGain(); g.gain.value = gain * 0.7;
    src.connect(g); g.connect(master);
    src.start(ctx.currentTime + delay);
  }

  /** Strum a list of midi notes (low to high). */
  function strum(midis, gain = 1) { midis.forEach((m, k) => pluck(m, k * 0.014, gain)); }

  return { pluck, strum, unlock: init };
})();
