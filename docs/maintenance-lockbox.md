# Maintenance Lockbox

Floor 4 generates exactly one `maintenance_lockbox` searchable as its authored
combination puzzle device. Floors 3, 2, 1, and 13 do not reuse that lockbox
prop; their puzzle devices are ordinary architectural locations and puzzle
completion grants progression directly. The Floor 13 finale has no physical
key pickup.

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
