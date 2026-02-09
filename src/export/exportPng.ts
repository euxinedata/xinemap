import { toPng } from 'html-to-image'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { Node } from '@xyflow/react'

const IMAGE_WIDTH = 2048
const IMAGE_HEIGHT = 1536
const PADDING = 0.15

export async function exportDiagramPng(
  flowElement: HTMLElement,
  nodes: Node[],
): Promise<void> {
  const bounds = getNodesBounds(nodes)
  const viewport = getViewportForBounds(
    bounds,
    IMAGE_WIDTH,
    IMAGE_HEIGHT,
    0.5,
    2,
    PADDING,
  )

  const viewportEl = flowElement.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewportEl) return

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: '#030712',
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    style: {
      width: String(IMAGE_WIDTH),
      height: String(IMAGE_HEIGHT),
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  })

  const link = document.createElement('a')
  link.download = 'diagram.png'
  link.href = dataUrl
  link.click()
}
