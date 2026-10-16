# Maintenance Lockbox

Normal Blocks 4, 3, 2, and 1 each generate exactly one `maintenance_lockbox`
searchable. Its result is a dedicated guaranteed staircase-key result, never
an ordinary loot-table roll. Block 13 retains its existing finale key/objective
placement.

Placement uses bounded breadth-first distances over the generated walkable tile
grid. It prefers remote dead-end/branch cells, with increasing minimum route
distances from spawn and stairs on deeper normal blocks. Stable tile iteration
breaks ties; the fallback remains reachable and avoids occupied interactables.
The placement code consumes no RNG. The lockbox position and searched state
are reproduced from the run seed and input log.

There is no authored production lockbox PNG in the current asset set. The
current implementation draws a compact pixel-aligned rusty metal lockbox
procedurally in `FloorScene`, nearest-neighbor rendered and subject to the
existing lightmap. Replace this fallback with an authored sprite in a later
presentation-only asset pass.
