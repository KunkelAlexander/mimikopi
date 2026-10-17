# Mimikopi

A no-typing guitar transcription tool built by Claude Code. 
This is for my personal use because I wanted an easy-to-use software. 
Plain HTML/CSS/JS, no build step.

Open `index.html` (or serve the folder) to use it. To host on GitHub Pages: push this folder to a repo,
then Settings > Pages > Deploy from branch > `main` / root.

Songs auto-save in the browser; use Export / Import to keep them as `.json` files.

## Possible future features

Ideas, not commitments. The first three are the likeliest next steps.

### Likely next
- **Loop and slow-down:** loop a selection or section during playback at 50 / 75 / 100% speed.
- **Example song and first-run hints:** a "Load example" button, and the shortcut list tucked behind a "?" button.
- **Optional step lengths:** one button for half / one / two beats per step, so riffs with uneven rhythm can be written down.

### Easier to use
- Set the chord at the cursor from the keyboard (`1`-`7` for the chords in the key).
- Clearer section labelling: show the selected range and make "these steps are the Verse" explicit.
- Click-drag to select steps, not only Shift+click.
- Suggest the chord name from the notes placed on a step, accepted with one click.
- Test and polish touch and tablet use.

### Better for learning
- "Hear the function" mode: play a scale degree against a drone of the chord root.
- Show each chord's shape on the fretboard, with optional fingering numbers.
- A one-line explanation next to labels such as "passing" or "outside the key".
- Pentatonic box and CAGED position overlays on the fretboard.
- A practice checklist per section (learned, up to tempo, memorised), saved with the song.
- Print / PDF export for a practice sheet.

### Maybe
- Replace the hammer-on / pull-off / slide buttons with a simple symbol on the note, if the current approach stays confusing.
- Transpose the whole piece; bends, mutes and harmonics.

### To check
- Playback audio has not been listened to yet; the plucked-string sound may need tuning.
- Two-digit fret entry (type `1` then `2` quickly for fret 12) may misfire.
