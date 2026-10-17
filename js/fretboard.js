/* Renders the clickable fretboard (open + frets 1-22) with chord tones, scale overlay and chord-shape ghost. */
const Fretboard = (() => {
  const FRETS = 22;
  const INLAY = { 3: 1, 5: 1, 7: 1, 9: 1, 12: 2, 15: 1, 17: 1, 19: 1, 21: 1 };

  function currentShape(song, chord) {
    return chord ? Theory.shape(chord, song.tuning) : null;
  }

  function render(el, view) {
    const song = State.song, key = song.key, cur = State.cur;
    const tun = Theory.TUNINGS[song.tuning].midi;
    const A = State.analyze();
    const step = song.steps[cur.step];
    const chord = A.chord[cur.step];
    const shape = view.shape ? currentShape(song, chord) : null;
    const scale = Theory.overlay(view.scale, key);

    const cols = ['30px'];
    for (let f = 0; f <= FRETS; f++) cols.push(`minmax(26px, ${(f === 0 ? 1.1 : 1.45 - f * 0.028).toFixed(3)}fr)`);

    let html = `<div class="fb" style="grid-template-columns:${cols.join(' ')}">`;
    for (let s = 5; s >= 0; s--) {
      let nm = Theory.spell(tun[s] % 12, key);
      if (s === 5 && nm.length === 1) nm = nm.toLowerCase();
      html += `<div class="fs-name${s === cur.str ? ' on' : ''}">${nm}</div>`;
      for (let f = 0; f <= FRETS; f++) {
        const pc = (tun[s] + f) % 12;
        const fx = Theory.fn(pc, chord, key);
        const noteHere = step.notes[s] && step.notes[s].fret === f;
        let kind = '';
        if (noteHere) kind = 'note';
        else if (shape && shape[s] === f) kind = 'ghost';
        else if (chord && (fx.cls === 'root' || fx.cls === 'chord')) kind = fx.cls;
        else if (scale && scale.has(pc)) kind = fx.cls === 'root' ? 'root' : 'scale';
        const ring = noteHere && s === cur.str ? ' ring' : '';
        const dot = kind ? `<span class="dot d-${kind}${ring}">${view.labels && kind !== 'ghost' ? fx.label : ''}</span>` : '';
        html += `<div class="fc s${s}${f === 0 ? ' f0' : ''}${s === cur.str ? ' cs' : ''}" data-s="${s}" data-f="${f}">${dot}</div>`;
      }
    }
    html += '<div></div>';
    for (let f = 0; f <= FRETS; f++) {
      const inl = INLAY[f] === 2 ? '●●' : INLAY[f] ? '●' : '';
      html += `<div class="fn"><span>${f === 0 ? '' : f}</span><small>${inl}</small></div>`;
    }
    html += '</div>';
    el.innerHTML = html;
  }

  return { render, currentShape };
})();
