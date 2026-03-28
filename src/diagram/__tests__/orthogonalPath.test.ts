import { describe, it, expect } from 'vitest'
import { Position } from '@xyflow/react'
import { orthogonalPath } from '../orthogonalPath'

/** Helper: extract all segment commands from an SVG path string */
function pathCommands(d: string) {
  return d.match(/[MLAQHVC][^MLAQHVC]*/gi) ?? []
}

describe('orthogonalPath', () => {
  describe('opposing faces', () => {
    it('Right-to-Left same Y produces straight horizontal line', () => {
      const d = orthogonalPath(0, 100, Position.Right, 200, 100, Position.Left)
      // Should be a simple M...L or M...H with no vertical component
      expect(d).toContain('M')
      // Start and end Y should both be 100
      const cmds = pathCommands(d)
      expect(cmds.length).toBeGreaterThanOrEqual(1)
      // No vertical movement — path should not change Y
      expect(d).not.toMatch(/[Vv]/)
    })

    it('Right-to-Left different Y produces H-V-H route', () => {
      const d = orthogonalPath(0, 50, Position.Right, 200, 150, Position.Left)
      expect(d).toContain('M')
      // Should contain at least one arc or line segment changing direction
      const cmds = pathCommands(d)
      expect(cmds.length).toBeGreaterThanOrEqual(3)
    })

    it('Top-to-Bottom same X produces straight vertical line', () => {
      const d = orthogonalPath(100, 0, Position.Top, 100, -200, Position.Bottom)
      expect(d).not.toMatch(/[Hh]/)
    })

    it('Bottom-to-Top different X produces V-H-V route', () => {
      const d = orthogonalPath(50, 0, Position.Bottom, 150, 200, Position.Top)
      const cmds = pathCommands(d)
      expect(cmds.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('same faces', () => {
    it('Right-to-Right produces U-shape route', () => {
      const d = orthogonalPath(0, 50, Position.Right, 0, 150, Position.Right)
      const cmds = pathCommands(d)
      // U-shape: at least H-V-H (3 segments + arcs)
      expect(cmds.length).toBeGreaterThanOrEqual(3)
    })

    it('Left-to-Left produces U-shape route', () => {
      const d = orthogonalPath(200, 50, Position.Left, 200, 150, Position.Left)
      const cmds = pathCommands(d)
      expect(cmds.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('perpendicular faces', () => {
    it('Right-to-Top natural quadrant produces L-shape', () => {
      // Target is to the right and above — natural for Right-to-Top
      const d = orthogonalPath(0, 100, Position.Right, 200, 0, Position.Top)
      const cmds = pathCommands(d)
      expect(cmds.length).toBeGreaterThanOrEqual(2)
    })

    it('Right-to-Top opposite quadrant produces S-shape', () => {
      // Target is to the left and below — opposite quadrant
      const d = orthogonalPath(200, 0, Position.Right, 0, 100, Position.Top)
      const cmds = pathCommands(d)
      expect(cmds.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('offset for parallel edges', () => {
    it('positive offset shifts path perpendicular', () => {
      const d0 = orthogonalPath(0, 100, Position.Right, 200, 100, Position.Left, 0)
      const d5 = orthogonalPath(0, 100, Position.Right, 200, 100, Position.Left, 5)
      expect(d0).not.toBe(d5)
    })

    it('negative offset shifts opposite direction', () => {
      const dPos = orthogonalPath(0, 100, Position.Right, 200, 100, Position.Left, 5)
      const dNeg = orthogonalPath(0, 100, Position.Right, 200, 100, Position.Left, -5)
      expect(dPos).not.toBe(dNeg)
    })
  })
})
