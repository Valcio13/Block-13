# Investigation UX & Notebook

The opening sequence retains its five authored plates and captions, but uses direct cuts at 1.7 seconds per plate (8.5 seconds total). Space/Enter still advances, Escape skips, and both paths close the presentation before the same Floor 4 simulation state begins. Fresh-run-only and replay/recovery guards are unchanged.

The field journal is a presentation projection of `loot_searched` clue events. It records generated evidence or authored notes only after the authoritative simulation confirms the search. The in-memory registry copy is keyed by canonical seed and deduplicated by floor/searchable identity; it is not a source of puzzle truth. Recovery rebuilds the journal while replaying the verified input log, then checks the normal authoritative state hash as before. Floor tabs show discovered note counts only; an empty tab says only that no notes have been recorded there.

Controls: **Tab** opens/closes the journal, left/right changes floor, up/down chooses among recovered notes, and Escape/Space closes it. Mouse clicks select floor tabs and notes. The journal pauses simulation through the existing presentation-modal gate. Puzzle state remains in the authoritative simulation and is unaffected by journal access.

## Floor 2 clarity audit

The generated circuit is solvable and consistent: four uniquely labeled feeds are generated, exactly two are designated, and the required maintenance diagram names those two by label. The authoritative switch mask is the same mask checked at submission; the UI blocks testing until the evidence clue is found. This pass found no generator/UI answer mismatch or placement defect.

The verified UX gap was presentation: the old panel gave a generic evidence counter, terse `[ON]/[OFF]` rows, and arrow-key hints, without naming the target relay or explaining the exact two-feed condition. It also had no direct route from the panel to the maintenance clue. The revised panel names the Archive relay, numbers each candidate feed, shows every state and its connection, explains that exactly the diagram's two named feeds must remain on, and offers an optional two-step H hint only after the diagram is recovered. The second hint repeats the already-discovered diagram verbatim. The Tab journal is available while the panel is open.

## Pixel-art UI provenance

The journal cover, paper inset, binding, tabs, and ruled details are drawn from Phaser rectangles/text using the project's existing monospaced UI typography and restrained ink/paper palette. Puzzle panels use native Phaser UI primitives. No external or raster artwork was introduced in this pass.

The notebook displays only discovered clue content. Floor 1's selectable event order is withheld until all three supporting documents are found, and Floor 13's unrecovered memory fragments and their associations render as blank placeholders. These checks are covered by `tests/investigationNotebook.test.ts` and `tests/puzzlePresentation.test.ts`.

Visual/browser usability still requires manual confirmation in a real playthrough; automated checks do not substitute for that review. For this pass the existing 5174 browser tab was stale (Vite HMR websocket disconnected). A new local preview on 5175 started successfully, but the in-app browser reported `ERR_CONNECTION_TIMED_OUT`; therefore no visual notebook or puzzle interaction is claimed as manually verified.
