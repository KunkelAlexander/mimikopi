/* Pure music logic: pitches, intervals, chords, scales, chord shapes. No DOM. */
const Theory = (() => {
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // MIDI numbers, string index 0 = lowest string. "uniform" = every string shifted equally (shapes still work).
  const TUNINGS = {
    standard: { name: 'Standard (E A D G B E)', midi: [40, 45, 50, 55, 59, 64], uniform: true },
    dropd: { name: 'Drop D', midi: [38, 45, 50, 55, 59, 64], uniform: false },
    eb: { name: 'Half step down (Eb)', midi: [39, 44, 49, 54, 58, 63], uniform: true },
    d: { name: 'Whole step down (D)', midi: [38, 43, 48, 53, 57, 62], uniform: true },
    dadgad: { name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62], uniform: false },
  };

  const INTERVALS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  const INTERVAL_NAMES = {
    R: 'root', b2: 'minor 2nd', '2': 'major 2nd / 9th', b3: 'minor 3rd', '3': 'major 3rd', '4': 'perfect 4th / 11th',
    b5: 'flat 5th / tritone', '5': 'perfect 5th', b6: 'minor 6th / b13', '6': 'major 6th / 13th',
    b7: 'minor 7th', '7': 'major 7th',
  };

  const CHORDS = {
    maj: { iv: [0, 4, 7], sfx: '' },
    min: { iv: [0, 3, 7], sfx: 'm' },
    '7': { iv: [0, 4, 7, 10], sfx: '7' },
    maj7: { iv: [0, 4, 7, 11], sfx: 'maj7' },
    m7: { iv: [0, 3, 7, 10], sfx: 'm7' },
    dim: { iv: [0, 3, 6], sfx: 'dim' },
    sus4: { iv: [0, 5, 7], sfx: 'sus4' },
    '5': { iv: [0, 7], sfx: '5' },
  };

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentMajor: [0, 2, 4, 7, 9],
    pentMinor: [0, 3, 5, 7, 10],
    bluesMinor: [0, 3, 5, 6, 7, 10],
    bluesMajor: [0, 2, 3, 4, 7, 9],
  };

  const ROMAN_MAJOR = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
  const ROMAN_MINOR = ['I', 'bII', 'II', 'III', '#III', 'IV', 'bV', 'V', 'VI', '#VI', 'VII', '#VII'];

  // Movable barre shapes: fret offsets from the root fret per string (low to high), null = muted.
  const E_FORM = {
    maj: [0, 2, 2, 1, 0, 0], min: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], maj7: [0, 2, 1, 1, 0, 0],
    m7: [0, 2, 0, 0, 0, 0], sus4: [0, 2, 2, 2, 0, 0], '5': [0, 2, 2, null, null, null],
  };
  const A_FORM = {
    maj: [null, 0, 2, 2, 2, 0], min: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], maj7: [null, 0, 2, 1, 2, 0],
    m7: [null, 0, 2, 0, 1, 0], dim: [null, 0, 1, 2, 1, null], sus4: [null, 0, 2, 2, 3, 0], '5': [null, 0, 2, 2, null, null],
  };

  const FLAT_MAJOR = [5, 10, 3, 8, 1, 6];
  const FLAT_MINOR = [2, 7, 0, 5, 10, 3];
  const useFlats = (key) => (key.mode === 'major' ? FLAT_MAJOR : FLAT_MINOR).includes(key.root);
  const spell = (pc, key) => (key && useFlats(key) ? FLAT : SHARP)[((pc % 12) + 12) % 12];
  const symbol = (chord, key) => spell(chord.root, key) + CHORDS[chord.q].sfx;
  const midi = (tun, str, fret) => tun[str] + fret;
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const octave = (m) => Math.floor(m / 12) - 1;

  const keyScale = (key) => SCALES[key.mode === 'major' ? 'major' : 'minor'].map((x) => (x + key.root) % 12);

  /** Function of a pitch class relative to the chord (or the key when there is no chord). */
  function fn(pc, chord, key) {
    const ref = chord ? chord.root : key.root;
    const iv = (pc - ref + 12) % 12;
    const label = INTERVALS[iv];
    let cls;
    if (chord) {
      const tones = CHORDS[chord.q].iv.map((x) => (x + chord.root) % 12);
      cls = iv === 0 ? 'root' : tones.includes(pc) ? 'chord' : keyScale(key).includes(pc) ? 'scale' : 'out';
    } else {
      cls = pc === key.root ? 'root' : keyScale(key).includes(pc) ? 'scale' : 'out';
    }
    return { label, cls };
  }

  function roman(chord, key) {
    const deg = (chord.root - key.root + 12) % 12;
    let r = (key.mode === 'major' ? ROMAN_MAJOR : ROMAN_MINOR)[deg];
    const minorish = chord.q === 'min' || chord.q === 'm7' || chord.q === 'dim';
    if (minorish) r = r.toLowerCase();
    const add = { dim: '°', '7': '7', maj7: 'maj7', m7: '7', sus4: 'sus4', '5': '5' }[chord.q] || '';
    return r + add;
  }

  /** Pitch classes shown by the scale overlay, or null when off. */
  function overlay(kind, key) {
    if (kind === 'key') return new Set(keyScale(key));
    const major = key.mode === 'major';
    const iv = kind === 'pent' ? SCALES[major ? 'pentMajor' : 'pentMinor']
      : kind === 'blues' ? SCALES[major ? 'bluesMajor' : 'bluesMinor'] : null;
    return iv ? new Set(iv.map((x) => (x + key.root) % 12)) : null;
  }

  /** Lowest-position barre/open shape for a chord: array of 6 frets (null = muted), or null. */
  function shape(chord, tuningId) {
    const t = TUNINGS[tuningId];
    if (!t || !t.uniform) return null;
    const cands = [];
    if (E_FORM[chord.q]) cands.push({ b: (chord.root - (t.midi[0] % 12) + 12) % 12, f: E_FORM[chord.q] });
    if (A_FORM[chord.q]) cands.push({ b: (chord.root - (t.midi[1] % 12) + 12) % 12, f: A_FORM[chord.q] });
    if (!cands.length) return null;
    cands.sort((a, b) => a.b - b.b);
    const { b, f } = cands[0];
    return f.map((o) => (o === null ? null : b + o));
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return { TUNINGS, CHORDS, INTERVAL_NAMES, spell, symbol, midi, freq, octave, fn, roman, overlay, shape, esc, keyScale };
})();
