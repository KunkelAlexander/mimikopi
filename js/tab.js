/* Renders the tab: section bands, chord row, 6 string rows per step. */
const Tab = (() => {
  const PRESETS = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Riff A', 'Riff B', 'Outro'];
  const SEC_BG = ['#e3effd', '#e1f5e7', '#fff0d9', '#fde4ea', '#ece4fa', '#dff3f3', '#fbf3cf', '#e9e9ee'];
  const SEC_FG = ['#0a58c4', '#17733a', '#9a5600', '#b3234d', '#6a3fb5', '#117a7a', '#7d6600', '#55555e'];
  const LINK = { h: 'h', p: 'p', s: '/' };
  const TAGS = { pass: 'pass', appr: 'appr', blue: 'blue', ghost: 'ghost' };

  function colorIdx(name) {
    let i = PRESETS.indexOf(name);
    if (i < 0) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; i = h; }
    return i % SEC_BG.length;
  }
  const secStyle = (name) => { const c = colorIdx(name); return `--sbg:${SEC_BG[c]};--sfg:${SEC_FG[c]}`; };

  function render(el, view) {
    const song = State.song, steps = song.steps, key = song.key, cur = State.cur;
    const tun = Theory.TUNINGS[song.tuning].midi;
    const A = State.analyze();
    const [lo, hi] = State.selection();
    const multi = lo !== hi;

    let html = '<div class="tabrow"><div class="gutter"><div class="g-band"></div><div class="g-chord"></div><div class="g-roman"></div>';
    for (let s = 5; s >= 0; s--) {
      let nm = Theory.spell(tun[s] % 12, key);
      if (s === 5 && nm.length === 1) nm = nm.toLowerCase();
      html += `<div class="g-str${s === cur.str ? ' on' : ''}">${nm}</div>`;
    }
    html += '<div class="g-mark"></div></div>';

    steps.forEach((st, i) => {
      const cls = ['step'];
      if (i === cur.step) cls.push('cur');
      if (multi && i >= lo && i <= hi) cls.push('sel');
      if (i === view.playing) cls.push('play');
      if (st.bar) cls.push('bar');

      // band
      const sec = A.sec[i];
      let band = '<div class="band"></div>';
      if (sec && sec.name) {
        const start = st.section === sec;
        const end = A.sec[i + 1] !== sec;
        const label = start ? `<span>${Theory.esc(sec.name)}${sec.times > 1 ? ' ×' + sec.times : ''}</span>` : '';
        band = `<div class="band on${start ? ' bs' : ''}${end ? ' be' : ''}" style="${secStyle(sec.name)}">${label}</div>`;
      }

      const chord = st.chord ? Theory.symbol(st.chord, key) : '';
      const roman = st.chord ? Theory.roman(st.chord, key) : '';
      let cells = '';
      for (let s = 5; s >= 0; s--) {
        const n = st.notes[s];
        let inner = '';
        if (n) {
          const m = Theory.midi(tun, s, n.fret);
          const f = Theory.fn(m % 12, A.chord[i], key);
          const fcls = n.tag ? 'f-tag' : 'f-' + f.cls;
          const label = n.tag ? TAGS[n.tag] : f.label;
          const fret = n.tag === 'ghost' ? `(${n.fret})` : n.fret;
          inner = `<span class="fret ${fcls}">${fret}${n.link ? `<i>${LINK[n.link]}</i>` : ''}${view.labels || n.tag ? `<sup>${label}</sup>` : ''}</span>`;
        }
        const here = i === cur.step && s === cur.str;
        cells += `<div class="cell${here ? ' cc' : ''}" data-i="${i}" data-s="${s}">${inner}</div>`;
      }
      html += `<div class="${cls.join(' ')}" data-i="${i}">${band}
        <div class="chordc">${Theory.esc(chord)}</div><div class="roman">${Theory.esc(roman)}</div>${cells}
        <div class="mark"${st.text ? ` title="${Theory.esc(st.text)}"` : ''}>${st.text ? '✎' : ''}</div></div>`;
    });

    html += '<div class="addcol" data-add="1" title="Add step">+</div></div>';
    el.innerHTML = html;

    // keep the active step in view (horizontal scroll only)
    const focus = view.playing >= 0 ? view.playing : cur.step;
    const node = el.querySelector(`.step[data-i="${focus}"]`);
    if (node) {
      const gw = 34, x = node.offsetLeft, w = node.offsetWidth;
      if (x < el.scrollLeft + gw + 8) el.scrollLeft = Math.max(0, x - gw - 8);
      else if (x + w > el.scrollLeft + el.clientWidth - 8) el.scrollLeft = x + w - el.clientWidth + 8;
    }
  }

  return { render, PRESETS };
})();
