import { Handle, Position } from '@xyflow/react'

const OFFSET = 5 // px from center for each paired handle
const hiddenCls = '!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0'

/**
 * Renders standard cardinal handles plus offset pairs (a/b) for parallel edges.
 * The offset handles sit ±5px from center so same-as link edges look like double bonds.
 */
export function ConceptualHandles({ color }: { color: string }) {
  const cls = '!w-2 !h-2'
  const bg = { background: color }
  return (
    <>
      {/* Standard center handles */}
      <Handle type="target" position={Position.Top} id="top-target" style={bg} className={cls} />
      <Handle type="source" position={Position.Top} id="top-source" style={bg} className={cls} />
      <Handle type="target" position={Position.Right} id="right-target" style={bg} className={cls} />
      <Handle type="source" position={Position.Right} id="right-source" style={bg} className={cls} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={bg} className={cls} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={bg} className={cls} />
      <Handle type="target" position={Position.Left} id="left-target" style={bg} className={cls} />
      <Handle type="source" position={Position.Left} id="left-source" style={bg} className={cls} />

      {/* Offset pair handles for top/bottom (shifted left/right) — invisible */}
      <Handle type="source" position={Position.Top} id="top-source-a" style={{ ...bg, left: `calc(50% - ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="source" position={Position.Top} id="top-source-b" style={{ ...bg, left: `calc(50% + ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="target" position={Position.Bottom} id="bottom-target-a" style={{ ...bg, left: `calc(50% - ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="target" position={Position.Bottom} id="bottom-target-b" style={{ ...bg, left: `calc(50% + ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="source" position={Position.Bottom} id="bottom-source-a" style={{ ...bg, left: `calc(50% - ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="source" position={Position.Bottom} id="bottom-source-b" style={{ ...bg, left: `calc(50% + ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="target" position={Position.Top} id="top-target-a" style={{ ...bg, left: `calc(50% - ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="target" position={Position.Top} id="top-target-b" style={{ ...bg, left: `calc(50% + ${OFFSET}px)` }} className={hiddenCls} />

      {/* Offset pair handles for left/right (shifted up/down) — invisible */}
      <Handle type="source" position={Position.Right} id="right-source-a" style={{ ...bg, top: `calc(50% - ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="source" position={Position.Right} id="right-source-b" style={{ ...bg, top: `calc(50% + ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="target" position={Position.Left} id="left-target-a" style={{ ...bg, top: `calc(50% - ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="target" position={Position.Left} id="left-target-b" style={{ ...bg, top: `calc(50% + ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="source" position={Position.Left} id="left-source-a" style={{ ...bg, top: `calc(50% - ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="source" position={Position.Left} id="left-source-b" style={{ ...bg, top: `calc(50% + ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="target" position={Position.Right} id="right-target-a" style={{ ...bg, top: `calc(50% - ${OFFSET}px)` }} className={hiddenCls} />
      <Handle type="target" position={Position.Right} id="right-target-b" style={{ ...bg, top: `calc(50% + ${OFFSET}px)` }} className={hiddenCls} />
    </>
  )
}
