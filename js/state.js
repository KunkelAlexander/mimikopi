/* Song model, cursor/selection, undo/redo, persistence, sections. No DOM except localStorage. */
const State = (() => {
  const LS = 'guitarTab.v1';
  const uid = () => 's' + Math.random().toString(36).slice(2, 8);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const blank = () => ({ title: 'Untitled song', tuning: 'standard', key: { root: 9, mode: 'minor' }, bpm: 90, steps: [{ notes: {} }] });

  function normalize(o) {
    const b = blank();
    if (!o || !Array.isArray(o.steps) || !o.steps.length) return b;
    b.title = String(o.title || b.title).slice(0, 60);
    b.tuning = Theory.TUNINGS[o.tuning] ? o.tuning : 'standard';
    b.bpm = Math.min(240, Math.max(40, Number(o.bpm) || 90));
    if (o.key && Number.isInteger(o.key.root) && o.key.root >= 0 && o.key.root < 12) {
      b.key = { root: o.key.root, mode: o.key.mode === 'major' ? 'major' : 'minor' };
    }
    const steps = o.steps.filter((s) => !s.repeat).map((s) => Object.assign({}, s, { notes: s.notes || {} }));
    if (steps.length) b.steps = steps;
    return b;
  }

  function load() {
    try { const t = localStorage.getItem(LS); return t ? normalize(JSON.parse(t)) : null; } catch (e) { return null; }
  }

  let song = load() || blank();
  const cur = { step: 0, str: 5 }; // str: 0 = lowest string ... 5 = highest
  let anchor = null;               // selection anchor step, null = no range
  let undoStack = [], redoStack = [], clip = null, lastKey = null, lastT = 0, saveTimer = null;
  const hooks = { change: () => {}, saved: () => {}, saving: () => {} };

  function clampCursor() {
    const n = song.steps.length;
    cur.step = Math.max(0, Math.min(n - 1, cur.step));
    if (anchor !== null) anchor = Math.max(0, Math.min(n - 1, anchor));
  }

  function persist() {
    hooks.saving();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(LS, JSON.stringify(song)); hooks.saved(true); } catch (e) { hooks.saved(false); }
    }, 300);
  }

  function commit(fn, co) {
    const now = Date.now();
    if (!(co && co === lastKey && now - lastT < 900)) {
      undoStack.push(JSON.stringify(song));
      if (undoStack.length > 150) undoStack.shift();
    }
    lastKey = co || null; lastT = now; redoStack = [];
    fn();
    clampCursor(); persist(); hooks.change();
  }

  function restore(text) { song = JSON.parse(text); clampCursor(); persist(); hooks.change(); }
  const undo = () => { if (undoStack.length) { redoStack.push(JSON.stringify(song)); restore(undoStack.pop()); } };
  const redo = () => { if (redoStack.length) { undoStack.push(JSON.stringify(song)); restore(redoStack.pop()); } };

  const selection = () => (anchor === null ? [cur.step, cur.step] : [Math.min(anchor, cur.step), Math.max(anchor, cur.step)]);

  // ---- navigation (no undo entry) ----
  function moveStep(d, extend) {
    const n = song.steps.length;
    let t = cur.step + d;
    if (t < 0) t = 0;
    if (t >= n) {
      if (extend) t = n - 1;
      else { song.steps.push({ notes: {} }); t = n; persist(); }
    }
    if (extend) { if (anchor === null) anchor = cur.step; } else anchor = null;
    cur.step = t; hooks.change();
  }
  function moveString(d) { cur.str = Math.max(0, Math.min(5, cur.str + d)); hooks.change(); }
  function goto(i, str, extend) {
    if (extend) { if (anchor === null) anchor = cur.step; } else anchor = null;
    cur.step = Math.max(0, Math.min(song.steps.length - 1, i));
    if (str !== null && str !== undefined) cur.str = str;
    hooks.change();
  }
  function selectAll() { anchor = 0; cur.step = song.steps.length - 1; hooks.change(); }
  function clearSelection() { if (anchor !== null) { anchor = null; hooks.change(); } }
  function appendStep() { song.steps.push({ notes: {} }); anchor = null; cur.step = song.steps.length - 1; persist(); hooks.change(); }

  // ---- analysis: section + chord in effect for each step ----
  function analyze() {
    const sec = [], chord = [];
    let cs = null, cc = null;
    song.steps.forEach((s, i) => {
      if (s.section) cs = s.section;
      if (s.chord) cc = s.chord;
      sec[i] = cs; chord[i] = cc;
    });
    return { sec, chord };
  }

  function sectionRange(id) {
    const st = song.steps;
    const a = st.findIndex((s) => s.section && s.section.id === id);
    if (a < 0) return null;
    let b = a;
    while (b + 1 < st.length && !st[b + 1].section) b++;
    return [a, b];
  }

  /** Playback order: expands x2 markers. */
  function sequence(from, to) {
    const st = song.steps, out = [];
    for (let i = from; i <= to; i++) {
      const s = st[i];
      if (s.section && s.section.times > 1) {
        const r = sectionRange(s.section.id);
        const end = Math.min(r[1], to);
        for (let t = 0; t < s.section.times; t++) for (let k = i; k <= end; k++) out.push(k);
        i = end; continue;
      }
      out.push(i);
    }
    return out;
  }

  // ---- edits (each is one undo step) ----
  const stepAt = (i) => song.steps[i];

  function setNote(i, str, fret) {
    commit(() => {
      const s = stepAt(i);
      const o = s.notes[str];
      s.notes[str] = Object.assign({}, o && o.tag ? { tag: o.tag } : {}, o && o.link ? { link: o.link } : {}, { fret });
    }, 'note' + i + '_' + str);
  }
  function setShape(i, frets) {
    commit(() => {
      const s = stepAt(i);
      s.notes = {};
      frets.forEach((f, str) => { if (f !== null) s.notes[str] = { fret: f }; });
    });
  }
  function clearNote(i, str) { commit(() => { const s = stepAt(i); if (s.notes && s.notes[str]) delete s.notes[str]; }); }
  function clearStep(i) { commit(() => { stepAt(i).notes = {}; }); }
  function toggleTag(tag) {
    const n = stepAt(cur.step).notes[cur.str]; if (!n) return false;
    commit(() => { if (n.tag === tag) delete n.tag; else n.tag = tag; });
    return true;
  }
  function toggleLink(kind) {
    const n = stepAt(cur.step).notes[cur.str]; if (!n) return false;
    commit(() => { if (n.link === kind) delete n.link; else n.link = kind; });
    return true;
  }
  function setChord(i, chord) { commit(() => { const s = stepAt(i); if (chord) s.chord = chord; else delete s.chord; }); }
  function toggleBar(i) { commit(() => { const s = stepAt(i); if (s.bar) delete s.bar; else s.bar = true; }); }
  function setText(i, text) { commit(() => { const s = stepAt(i); if (text) s.text = text; else delete s.text; }, 'text' + i); }
  function insertAfter(i) { commit(() => { song.steps.splice(i + 1, 0, { notes: {} }); cur.step = i + 1; anchor = null; }); }

  function deleteSteps(lo, hi) {
    commit(() => {
      const removed = song.steps.splice(lo, hi - lo + 1);
      const lastMarker = removed.slice().reverse().find((s) => s.section);
      if (!song.steps.length) song.steps.push({ notes: {} });
      const nxt = song.steps[lo];
      if (lastMarker && nxt && !nxt.section) nxt.section = lastMarker.section;
      cur.step = Math.min(lo, song.steps.length - 1); anchor = null;
    });
  }

  function copy() { const [lo, hi] = selection(); clip = clone(song.steps.slice(lo, hi + 1)); return clip.length; }
  function newSectionIds(steps) { steps.forEach((s) => { if (s.section) s.section.id = uid(); }); }
  function paste() {
    if (!clip) return false;
    const hi = selection()[1];
    commit(() => {
      const c = clone(clip); newSectionIds(c);
      song.steps.splice(hi + 1, 0, ...c);
      const after = song.steps[hi + 1 + c.length];
      if (c.some((s) => s.section) && after && !after.section) after.section = { id: uid(), name: '', times: 1 };
      anchor = c.length > 1 ? hi + 1 : null;
      cur.step = hi + c.length;
    });
    return true;
  }

  // ---- sections ----
  function setSection(name) {
    const [lo, hi] = selection();
    commit(() => {
      const s = stepAt(lo);
      if (s.section && s.section.name === name) { delete s.section; return; }
      s.section = { id: s.section ? s.section.id : uid(), name, times: s.section ? s.section.times : 1 };
      const nxt = song.steps[hi + 1];
      if (lo !== hi && nxt && !nxt.section) nxt.section = { id: uid(), name: '', times: 1 };
      anchor = null;
    });
  }
  function currentSection() { return analyze().sec[cur.step]; }
  function renameSection(name) { const s = currentSection(); if (s) commit(() => { s.name = name; }); }
  function cycleTimes() { const s = currentSection(); if (s) commit(() => { s.times = (s.times || 1) % 4 + 1; }); }
  function removeSection() {
    const s = currentSection(); if (!s) return;
    commit(() => { const st = song.steps.find((x) => x.section === s); if (st) delete st.section; });
  }

  // ---- song-level ----
  const setTitle = (t) => commit(() => { song.title = t.slice(0, 60); }, 'title');
  const setKey = (root, mode) => commit(() => { song.key = { root, mode }; });
  const setTuning = (id) => commit(() => { song.tuning = id; });
  const setTempo = (bpm) => commit(() => { song.bpm = bpm; }, 'tempo');
  const exportJSON = () => JSON.stringify(song, null, 2);
  function replaceSong(o) { commit(() => { song = normalize(o); cur.step = 0; cur.str = 5; anchor = null; }); }
  const importJSON = (text) => { const o = JSON.parse(text); if (!o || !Array.isArray(o.steps)) throw new Error('Not a song file'); replaceSong(o); };
  const newSong = () => replaceSong(blank());

  return {
    get song() { return song; }, cur, hooks,
    get canUndo() { return undoStack.length > 0; }, get canRedo() { return redoStack.length > 0; },
    get hasClip() { return !!clip; },
    selection, analyze, sectionRange, sequence,
    moveStep, moveString, goto, selectAll, clearSelection, appendStep,
    setNote, setShape, clearNote, clearStep, toggleTag, toggleLink, setChord, toggleBar, setText, insertAfter, deleteSteps,
    copy, paste, setSection, renameSection, cycleTimes, removeSection, currentSection,
    setTitle, setKey, setTuning, setTempo, exportJSON, importJSON, newSong, undo, redo,
  };
})();
