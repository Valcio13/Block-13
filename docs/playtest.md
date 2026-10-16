# Local Playtest Guide

Run `npm run dev`, then start a Local run from the title screen. The following
query parameters are development-only and apply only to Local runs:

- `playtestFloor=block4|block3|block2|block1|block13` (or `4|3|2|1|13`)
- `playtestSeed=<unsigned 64-bit integer>`; defaults to `13` when a floor is set

Example: `http://127.0.0.1:3000/?playtestFloor=block13&playtestSeed=13`.
Keep the same seed and floor URL to reproduce map layout, entity placement,
simulation decisions, and the resulting sequence of inputs. The override is
ignored by production builds and manifest-backed runs; it does not add any
production menu or change simulation rules.

## Existing in-game previews

These controls are enabled only for development Local runs:

- `F6`: cycle the floor music preview
- `F7`: play the Ambusher scare timeline
- `F10`: play Ambusher impact audio (kept separate from Block 3's `F8` art toggle)
- `F9`: play the jumpscare hit fallback directly
- `F2` / `F3` / `F4` / `F5` / `F11` / `F12`: preview Stalker presence, Stalker
  hunt, Watcher presence, Watcher gaze, Crawler skitter, or Mimic reveal audio
  at a nearby positional source
- `F1`: preview the Ambusher warning cue
- `H` / `J` / `K` / `L` / `I`: preview false footstep, silence, silhouette,
  false Stalker, or environment shift presentation
- `F8` on Block 3: toggle Original/Refined artwork
- `?ambusherVariant=A|B|C|D`: select a specific Ambusher composition for the
  `F7` preview or a real local Ambusher scare

The direct jumpscare hit check on `F9` scales down when Reduced Jumpscare
Intensity is enabled. The `F1` cue preview can be intercepted by browser help
on some systems; if so, use a real Ambusher warning encounter to verify it.

These are presentation previews, not simulations of the corresponding enemy
mechanics. Use ordinary movement and interactions to verify actual detection,
damage, gaze, reveal, search, and progression behavior. Seeds make those real
encounters repeatable once the same input route is repeated.

Pause with `ESC` during timed effects, resume, and verify that temporary
visuals and ambience ducking clear or restore as expected. For each floor,
record the seed, URL, input route, expected cue, and actual observation in the
playtest notes. Use the Audio Settings panel to repeat checks with SFX muted,
volume sliders reduced, and Reduced Jumpscare Intensity enabled.

The dev server's preview helpers are guarded by `import.meta.env.DEV`; confirm
the production build remains clean with `npm run build` before release.
