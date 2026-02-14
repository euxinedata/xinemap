# Fix conceptual view edge routing to use all 4 cardinal handles

## Context
Conceptual view edges all bunch up through one side of nodes because `assignEdgeHandles` (edgeHandles.ts:15) explicitly skips conceptual edges — they get no `sourceHandle`/`targetHandle`, so React Flow routes them all to the default (first) handle. The conceptual nodes already have handles on all 4 sides (top/right/bottom/left), they just aren't being assigned.

## Change

**File: `src/diagram/edgeHandles.ts`**

Remove the early return for conceptual edges (line 15). Instead, when there's no column data, pick the best cardinal handle based on relative node positions:

- Compare source and target positions
- Choose the side where the edge should exit/enter based on which direction the target is relative to the source
- Use the angle between node centers to pick the closest cardinal direction (top/right/bottom/left)
- Assign handle IDs like `top-source`/`bottom-target` matching the existing handle IDs in the conceptual node components

The handle ID format in conceptual nodes is: `{position}-{type}` (e.g., `top-source`, `right-target`, `bottom-source`, `left-target`).

The logic:
1. Compute angle from source center to target center
2. Map angle to nearest cardinal direction
3. Source exits toward target, target enters from source's direction (opposite side)

## Verification
1. `npm run dev`
2. Switch to conceptual view
3. Verify edges enter/exit nodes from the side closest to the connected node
4. Verify edges spread around all 4 sides instead of bunching up
