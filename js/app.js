/* Wiring: controls, keyboard, playback. */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const tabEl = $('#tab'), fbEl = $('#fretboard');
  const VIEW_KEY = 'guitarTab.view';
  const QUALS = [['maj', 'maj'], ['min', 'm'], ['7', '7'], ['maj7', 'maj7'], ['m7', 'm7'], ['dim', 'dim'], ['sus4', 'sus4'], ['5', '5']];

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(VIEW_KEY)) || {}; } catch (e) { /* ignore */ }
  const view = Object.assign({ labels: true, scale: 'off', shape: true, advance: true }, saved, { playing: -1 });
  const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ labels: view.labels, scale: view.scale, shape: view.shape, advance: view.advance })); } catch (e) { /* ignore */ } };

  // ---------- static control setup ----------
  $('#tuning').innerHTML = Object.entries(Theory.TUNINGS).map(([id, t]) => `<option value="${id}">${t.name}</option>`).join('');
  $('#roots').innerHTML = Array.from({ length: 12 }, (_, r) => `<button class="pill sq" data-root="${r}"></button>`).join('');
  $('#quals').innerHTML = QUALS.map(([q, l]) => `<button class="pill sq" data-q="${q}">${l}</button>`).join('');
  $('#presets').innerHTML = Tab.PRESETS.map((n) => `<button class="pill sm" data-sec="${n}">${n}</button>`).join('');

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  const tuningMidi = () => Theory.TUNINGS[State.song.tuning].midi;
  const stepNow = () => State.song.steps[State.cur.step];
  const strName = (s) => { const n = Theory.spell(tuningMidi()[s] % 12, State.song.key); return s === 5 && n.length === 1 ? n.toLowerCase() : n; };

  // ---------- render ----------
  function render() {
    Tab.render(tabEl, view);
    Fretboard.render(fbEl, view);
    refresh();
  }

  function refresh() {
    const song = State.song, key = song.key, cur = State.cur, A = State.analyze();
    const i = cur.step, st = song.steps[i];
    $('#keyRoot').value = key.root; $('#keyMode').value = key.mode; $('#tuning').value = song.tuning;
    $('#tempo').value = song.bpm; $('#tempoVal').textContent = song.bpm;
    if (document.activeElement !== $('#title')) $('#title').value = song.title;
    $$('[data-toggle]').forEach((b) => b.classList.toggle('on', !!view[b.dataset.toggle]));
    $('#scale').value = view.scale;
    $('#btnUndo').disabled = !State.canUndo; $('#btnRedo').disabled = !State.canRedo;
    $('#btnPlay').innerHTML = playing ? '&#9632; Stop' : '&#9654; Play';

    // chord card
    const eff = st.chord || A.chord[i];
    $('#chordInfo').innerHTML = eff ? `<b>${Theory.symbol(eff, key)}</b> (${Theory.roman(eff, key)})${st.chord ? ' starts on this step.' : ' carried over from an earlier step.'}`
        : 'No chord yet. Pick one below and notes get labelled by their function in it.';
    $('#chordClear').disabled = !st.chord;
    $$('[data-root]').forEach((b) => { const r = +b.dataset.root; b.textContent = Theory.spell(r, key); b.classList.toggle('on', !!eff && eff.root === r); });
    $$('[data-q]').forEach((b) => b.classList.toggle('on', !!eff && eff.q === b.dataset.q));
    const degs = key.mode === 'major'
      ? [[0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min'], [11, 'dim']]
      : [[0, 'min'], [2, 'dim'], [3, 'maj'], [5, 'min'], [7, 'min'], [8, 'maj'], [10, 'maj']];
    $('#dia').innerHTML = degs.map(([o, q]) => {
      const c = { root: (key.root + o) % 12, q };
      const on = eff && eff.root === c.root && eff.q === c.q ? ' on' : '';
      return `<button class="pill dia${on}" data-chord="${c.root}|${q}"><b>${Theory.symbol(c, key)}</b><small>${Theory.roman(c, key)}</small></button>`;
    }).join('');

    // note card
    const n = st.notes[cur.str];
    let info;
    if (n) {
      const m = Theory.midi(tuningMidi(), cur.str, n.fret), f = Theory.fn(m % 12, A.chord[i], key);
      const ref = A.chord[i] ? Theory.symbol(A.chord[i], key) : key.mode === 'major' ? Theory.spell(key.root, key) : Theory.spell(key.root, key) + 'm';
      const where = { root: 'chord tone', chord: 'chord tone', scale: 'in the key but not in the chord', out: 'outside the key' }[f.cls];
      info = `<b>${Theory.spell(m % 12, key)}${Theory.octave(m)}</b> &middot; string ${strName(cur.str)}, fret ${n.fret}<br>${f.label} (${Theory.INTERVAL_NAMES[f.label]}) of ${ref} &middot; ${where}`;
    } else info = `Step ${i + 1}, string ${strName(cur.str)}: empty. Click the fretboard or type a fret number.`;
    $('#noteInfo').innerHTML = info;
    $$('[data-tag]').forEach((b) => { b.disabled = !n; b.classList.toggle('on', !!n && n.tag === b.dataset.tag); });
    $$('[data-link]').forEach((b) => { b.disabled = !n; b.classList.toggle('on', !!n && n.link === b.dataset.link); });
    $('#barBtn').classList.toggle('on', !!st.bar);
    const ta = $('#stepText');
    if (document.activeElement !== ta) ta.value = st.text || '';

    // sections card
    const sec = A.sec[i];
    $('#secInfo').textContent = sec && sec.name ? `In: ${sec.name}${sec.times > 1 ? ' ×' + sec.times : ''}` : '';
    $$('[data-sec]').forEach((b) => b.classList.toggle('on', !!sec && sec.name === b.dataset.sec));
    const hasSec = !!(sec && sec.name);
    $('#secTimes').disabled = !hasSec; $('#secRename').disabled = !hasSec; $('#secRemove').disabled = !hasSec;
    $('#secTimes').innerHTML = hasSec && sec.times > 1 ? `Repeat &times;${sec.times}` : 'Repeat &times;2';
  }

  // ---------- state hooks ----------
  State.hooks.change = render;
  State.hooks.saving = () => { $('#sdot').classList.add('busy'); $('#saved').textContent = 'Saving…'; };
  State.hooks.saved = (ok) => { $('#sdot').classList.remove('busy'); $('#saved').textContent = ok ? 'Saved in this browser' : 'Not saved (storage blocked)'; };

  // ---------- note entry ----------
  function placeNote(str, fret) {
    State.cur.str = str;
    State.setNote(State.cur.step, str, fret);
    Sound.pluck(Theory.midi(tuningMidi(), str, fret));
  }

  fbEl.addEventListener('click', (e) => {
    const c = e.target.closest('.fc[data-s]'); if (!c) return;
    const s = +c.dataset.s, f = +c.dataset.f, i = State.cur.step;
    if (c.querySelector('.d-ghost')) {
      const chord = State.analyze().chord[i], shape = Fretboard.currentShape(State.song, chord);
      if (shape) {
        State.setShape(i, shape);
        Sound.strum(shape.map((fr, str) => (fr === null ? null : Theory.midi(tuningMidi(), str, fr))).filter((m) => m !== null));
      }
    } else placeNote(s, f);
    if (view.advance && !e.shiftKey) State.moveStep(1);
  });

  tabEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { State.appendStep(); return; }
    const t = e.target.closest('[data-i]'); if (!t) return;
    const s = t.dataset.s !== undefined ? +t.dataset.s : null;
    State.goto(+t.dataset.i, s, e.shiftKey);
    const n = s !== null && State.song.steps[+t.dataset.i].notes[s];
    if (n) Sound.pluck(Theory.midi(tuningMidi(), s, n.fret));
  });

  // ---------- chord ----------
  function applyChord(patch) {
    const i = State.cur.step, st = State.song.steps[i];
    const base = st.chord || State.analyze().chord[i] || { root: State.song.key.root, q: 'maj' };
    const chord = Object.assign({ root: base.root, q: base.q }, patch);
    State.setChord(i, chord);
    const shape = Theory.shape(chord, State.song.tuning);
    if (shape) Sound.strum(shape.map((fr, s) => (fr === null ? null : Theory.midi(tuningMidi(), s, fr))).filter((m) => m !== null), 0.7);
  }
  $('#roots').addEventListener('click', (e) => { const b = e.target.closest('[data-root]'); if (b) applyChord({ root: +b.dataset.root }); });
  $('#quals').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) applyChord({ q: b.dataset.q }); });
  $('#dia').addEventListener('click', (e) => {
    const b = e.target.closest('[data-chord]'); if (!b) return;
    const [r, q] = b.dataset.chord.split('|'); applyChord({ root: +r, q });
  });

  // ---------- note tags / technique ----------
  $$('[data-tag]').forEach((b) => b.addEventListener('click', () => State.toggleTag(b.dataset.tag)));
  $$('[data-link]').forEach((b) => b.addEventListener('click', () => State.toggleLink(b.dataset.link)));
  $('#stepText').addEventListener('input', (e) => { State.setText(State.cur.step, e.target.value.slice(0, 200)); });
  $('#presets').addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (b) State.setSection(b.dataset.sec); });

  // ---------- toolbar selects / toggles ----------
  const blurAfter = (el) => el.addEventListener('change', () => el.blur());
  ['#keyRoot', '#keyMode', '#tuning', '#scale', '#tempo'].forEach((s) => blurAfter($(s)));
  $('#keyRoot').addEventListener('change', (e) => State.setKey(+e.target.value, State.song.key.mode));
  $('#keyMode').addEventListener('change', (e) => State.setKey(State.song.key.root, e.target.value));
  $('#tuning').addEventListener('change', (e) => State.setTuning(e.target.value));
  $('#tempo').addEventListener('input', (e) => State.setTempo(+e.target.value));
  $('#scale').addEventListener('change', (e) => { view.scale = e.target.value; saveView(); render(); });
  $('#title').addEventListener('input', (e) => State.setTitle(e.target.value));
  $$('[data-toggle]').forEach((b) => b.addEventListener('click', () => { view[b.dataset.toggle] = !view[b.dataset.toggle]; saveView(); render(); }));

  // ---------- actions ----------
  function deleteSelection() { const [lo, hi] = State.selection(); State.deleteSteps(lo, hi); }
  function exportFile() {
    const blob = new Blob([State.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ((State.song.title || 'song').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'song') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importText(text) {
    try { State.importJSON(text); toast('Song loaded'); } catch (err) { toast('That file is not a song file'); }
  }
  $('#file').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => importText(String(r.result)); r.readAsText(f); e.target.value = '';
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => importText(String(r.result)); r.readAsText(f);
  });

  const acts = {
    play: () => togglePlay(), undo: () => State.undo(), redo: () => State.redo(), export: exportFile,
    import: () => $('#file').click(),
    new: () => { if (confirm('Start a new empty song? You can still undo this.')) State.newSong(); },
    copy: () => toast(`Copied ${State.copy()} step${State.selection()[0] === State.selection()[1] ? '' : 's'}`),
    cut: () => { State.copy(); deleteSelection(); },
    paste: () => { if (!State.paste()) toast('Nothing copied yet'); },
    dup: () => { State.copy(); State.paste(); },
    del: deleteSelection,
    'clear-step': () => State.clearStep(State.cur.step),
    'chord-clear': () => State.setChord(State.cur.step, null),
    bar: () => State.toggleBar(State.cur.step),
    'sec-times': () => State.cycleTimes(),
    'sec-rename': () => { const s = State.currentSection(); const n = s && prompt('Section name', s.name); if (n) State.renameSection(n.slice(0, 24)); },
    'sec-remove': () => State.removeSection(),
  };
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && acts[b.dataset.act]) acts[b.dataset.act](); });
  // keep focus off buttons so Space / Enter go to the editor, not the last-clicked button
  document.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });

  // ---------- playback ----------
  let playing = false, timer = null, seq = [], pos = 0;
  function tick() {
    if (pos >= seq.length) { stop(); return; }
    const steps = State.song.steps, i = seq[pos], st = steps[i], prev = pos > 0 ? steps[seq[pos - 1]] : null, tun = tuningMidi();
    view.playing = i;
    Object.keys(st.notes || {}).map(Number).sort((a, b) => a - b).forEach((s, k) => {
      const n = st.notes[s];
      const legato = prev && prev.notes && prev.notes[s] && prev.notes[s].link;
      Sound.pluck(Theory.midi(tun, s, n.fret), legato ? 0 : k * 0.014, legato ? 0.55 : n.tag === 'ghost' ? 0.35 : 1);
    });
    render();
    pos++;
    timer = setTimeout(tick, 30000 / State.song.bpm);
  }
  function start() {
    const [lo, hi] = State.selection(), n = State.song.steps.length;
    seq = lo !== hi ? State.sequence(lo, hi) : State.sequence(State.cur.step, n - 1);
    if (!seq.length) return;
    pos = 0; playing = true; Sound.unlock(); tick();
  }
  function stop() { clearTimeout(timer); timer = null; playing = false; view.playing = -1; render(); }
  function togglePlay() { if (playing) stop(); else start(); }

  // ---------- keyboard ----------
  let digit = { v: 0, str: -1, step: -1, t: 0 };
  function typeDigit(d) {
    const c = State.cur, now = Date.now();
    let fret = d;
    if (digit.str === c.str && digit.step === c.step && now - digit.t < 700 && digit.v >= 1 && digit.v * 10 + d <= 22) fret = digit.v * 10 + d;
    digit = { v: fret, str: c.str, step: c.step, t: now };
    placeNote(c.str, fret);
  }

  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    const done = () => e.preventDefault();

    if (mod) {
      const l = k.toLowerCase();
      if (l === 'z') { done(); e.shiftKey ? State.redo() : State.undo(); }
      else if (l === 'y') { done(); State.redo(); }
      else if (l === 'c') { done(); acts.copy(); }
      else if (l === 'x') { done(); acts.cut(); }
      else if (l === 'v') { done(); acts.paste(); }
      else if (l === 'd') { done(); acts.dup(); }
      else if (l === 'a') { done(); State.selectAll(); }
      return;
    }
    if (e.altKey) return;

    if (k === 'ArrowRight') { done(); State.moveStep(1, e.shiftKey); }
    else if (k === 'ArrowLeft') { done(); State.moveStep(-1, e.shiftKey); }
    else if (k === 'ArrowUp') { done(); State.moveString(1); }
    else if (k === 'ArrowDown') { done(); State.moveString(-1); }
    else if (k === 'Home') { done(); State.goto(0, null, e.shiftKey); }
    else if (k === 'End') { done(); State.goto(State.song.steps.length - 1, null, e.shiftKey); }
    else if (/^[0-9]$/.test(k)) { done(); typeDigit(+k); }
    else if (k === 'Backspace' || k === 'Delete') {
      done();
      if (e.shiftKey || State.selection()[0] !== State.selection()[1]) deleteSelection();
      else State.clearNote(State.cur.step, State.cur.str);
    }
    else if (k === 'Enter') { done(); State.insertAfter(State.selection()[1]); }
    else if (k === ' ') { done(); togglePlay(); }
    else if (k === 'b' || k === 'B' || k === '|') { done(); State.toggleBar(State.cur.step); }
    else if (k === 'h' || k === 'p' || k === 's') { done(); if (!State.toggleLink(k)) toast('Place a note first'); }
    else if (k === 'Escape') { if (playing) stop(); else State.clearSelection(); }
  });

  render();
})();
