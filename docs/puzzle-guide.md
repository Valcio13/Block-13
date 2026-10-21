# Floor 13 Puzzle Guide

This guide explains the five investigation puzzles in the current game. Each
floor has one deterministic puzzle generated from the run seed. The clues and
answer order change between runs, but the interaction rules stay the same.

## General rules

1. Search every marked evidence location for the floor before submitting an
   answer. The puzzle panel shows the recovered evidence count.
2. Stand at the puzzle device and press **E** to open it.
3. Use the directional controls shown in the panel to select and edit entries.
4. Press **E** to submit or confirm. Press **F**, **Escape**, or the panel's
   close control to leave the puzzle. Press **Tab** to open the field-notes
   notebook and review recovered clues.
5. A wrong submission consumes one attempt. The panel always shows attempts
   remaining. After the final failed attempt, normal entry is disabled and the
   panel tells you exactly which fallback item to find and return with.

Opening a puzzle pauses movement, enemy updates, damage, battery drain, and
curse accumulation. Puzzle actions are still recorded and replayed as normal
input actions.

## Floor 4 — The Locked Box

**Objective:** Open the maintenance lockbox with a three-digit code.

Search the three evidence notes. Each note gives one arithmetic expression and
labels its position:

- Calendar → **Position 1**
- Photograph → **Position 2**
- Apartment mark → **Position 3**

Calculate each expression, then keep only its final (ones) digit. Enter the
three results in that order. The writing around the arithmetic is part of the
investigation: the records contain details about a resident the register says
never lived in the building. The panel shows the live code as `_ _ _`, labels
the selected position, and shows the expression beside its current digit.

**Controls:** left/right selects a position; up/down changes its digit; **E**
submits the code.

Three failed submissions jam the lockbox. The objective changes to **FIND THE
MAINTENANCE TOOL**. Search for that marked fallback item, then return to the
lockbox and press **E** to complete the floor.

Success opens the box, grants the progression reward, and plays the puzzle
completion feedback.

## Floor 3 — The Missing Resident

**Objective:** Identify the one resident who matches both recovered rules.

Recover both resident records, then compare the four directory entries. The two
rules are generated per run, but use this structure:

- The missing resident has the **same bicycle status** as the referenced
  apartment.
- The missing resident has the **opposite night-shift status** from the other
  referenced apartment.

Apply both rules to the directory; only one resident should remain. The panel
shows each resident's apartment, bicycle status, and night-shift status.

**Controls:** up/down selects a resident; **E** submits the selected resident.

Three failed submissions disable the directory. The objective changes to **FIND
THE ARCHIVAL CLUE**. Recover that fallback clue, return to the directory, and
press **E** to finish.

## Floor 2 — The Archive Circuit

**Objective:** Restore power to the archive relay.

Find the maintenance diagram. It identifies exactly two of the four labeled
feeds and gives their order. Turn on only those two feeds, in the stated
sequence; leave the other two off, then test the route.

The panel shows the sequence you have entered, a checkpoint count, and each
feed's `ON`/`OFF` state. It does not reveal the next correct feed; use the
recovered diagram to determine the order.

**Controls:** left/right selects a feed; up toggles it; **E** tests the route.

If the route is wrong, use the panel feedback to correct the sequence before
testing again. If the circuit reaches its fallback state, the objective changes
to **FIND THE RELAY OVERRIDE**. Bring that marked override back to the breaker
panel to complete the floor.

## Floor 1 — The Contradictory Records

**Objective:** Reconstruct the true order of three events surrounding the
building's disappearance.

Recover all three records. The clues describe a sealed tenant register, an
impossible stairwell inspection, and the building disappearing from the city
index. They provide two `BEFORE` relationships and a final instruction to
build one order:

`FIRST → SECOND → THIRD`

Use both relationships together. The panel lists the three generated events,
shows the partial order as you place entries, and marks placed events.

**Controls:** up/down selects an event; **E** places the selected event as the
next entry in the order.

If the index reaches its fallback state, the objective changes to **FIND THE
UNALTERED INDEX**. Recover it and return to the archive index to complete the
floor.

## Floor 13 — The Final Memory

**Objective:** Reconnect the three recovered memories to the place each one
names.

Recover the three memory fragments and read the available place choices. Match
each fragment to its named location. The choices are shuffled each run, so use
the wording of the fragment rather than a fixed screen position.

The three links are:

- The anonymous message → the Floor 4 visit
- The erased resident record → the Floor 3 missing-resident investigation
- The sealed record and handwriting → the Floor 1 sealed record

The panel shows confirmed links and lets you edit one fragment at a time.

**Controls:** left/right selects a fragment; up/down changes its place; **E**
confirms the match.

Each confirmed link is a recovered piece of the investigation. When all three
are connected, the game briefly drops the ambient sound and shows a final
memory reveal before restoring the mix and opening the finale route. There is
no physical key pickup on Floor 13.

If the memory archive reaches its fallback state, the objective changes to **FIND
THE MEMORY FRAGMENT**. Recover the marked fragment and return to the archive.

## Reading the feedback

- **Evidence locked:** search the remaining marked notes before submitting.
- **Attempts remaining:** the normal puzzle still accepts submissions.
- **Incorrect answer:** one attempt was consumed; correct the selection and try
  again.
- **Locked — find the fallback:** normal entry is disabled; follow the new
  objective marker and return with the named item.
- **Puzzle solved:** the floor objective is complete and the next route can be
  used.

The generated answers are never displayed directly in the notebook. The
notebook preserves the intended deduction while the puzzle panel exposes the
current selection, progress, and controls clearly.
