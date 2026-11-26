import { describe, it, expect } from 'vitest'
import { isNearPoint, centroid, pointInPolygon, pxToNormTolerance, areaM2 } from '../polygonGeometry'
import { MIN_RECT_SIZE_PX } from '../../components/PhotoCanvas'

describe('isNearPoint', () => {
  it('returns true when within tolerance', () => {
    expect(isNearPoint({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }, 0.02)).toBe(true)
  })
  it('returns false when outside tolerance', () => {
    expect(isNearPoint({ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }, 0.02)).toBe(false)
  })
})

describe('centroid', () => {
  it('computes the average of all points', () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]))
      .toEqual({ x: 0.5, y: 0.5 })
  })
  it('returns the single point for a 1-point array', () => {
    expect(centroid([{ x: 0.3, y: 0.7 }])).toEqual({ x: 0.3, y: 0.7 })
  })
})

describe('pxToNormTolerance', () => {
  it('keeps the close-vertex radius visually constant in screen pixels regardless of zoom', () => {
    // Same 12px on-screen tolerance, but the container is 10x wider at max zoom.
    // A click 8% of the (zoomed-in) image away from vertex 1 must NOT count as
    // "closing the polygon" — only a click within 12 actual screen pixels should.
    const baseWidthPx = 800 // scale 1
    const zoomedWidthPx = 8000 // scale 10 (MAX_SCALE)

    const toleranceAtBase = pxToNormTolerance(12, baseWidthPx)
    const toleranceAtZoom = pxToNormTolerance(12, zoomedWidthPx)

    expect(toleranceAtZoom).toBeLessThan(toleranceAtBase)

    // A point 8% of normalized width away from vertex 1 (large on screen at max
    // zoom: 8% * 8000px = 640px) must read as "not near" once zoom-corrected —
    // this is exactly the click meant to place vertex 4, which previously
    // collapsed the polygon into a triangle under the old fixed normalized tolerance.
    const vertex1 = { x: 0.2, y: 0.2 }
    const fourthVertexClick = { x: 0.28, y: 0.2 }
    expect(isNearPoint(vertex1, fourthVertexClick, toleranceAtZoom)).toBe(false)
  })

  it('keeps a fixed-px minimum drag size achievable at high zoom (inverse case: rect tool)', () => {
    // The old rect-tool gate (`d.w > 0.02`) was a fixed normalized minimum. At
    // high zoom the rendered container is much wider, so the SAME on-screen drag
    // distance maps to a smaller normalized delta — a clearly intentional ~40px
    // drag could fall under the 0.02 floor and the rectangle would silently never
    // get created. Converting the floor itself to px-then-normalized fixes this:
    // an 8px-equivalent normalized delta must clear an 8px-equivalent floor at
    // any zoom level.
    const baseWidthPx = 800 // scale 1
    const zoomedWidthPx = 8000 // scale 10 (MAX_SCALE)
    const dragPx = 40

    const dragNormAtZoom = dragPx / zoomedWidthPx
    const oldFixedFloor = 0.02
    expect(dragNormAtZoom).toBeLessThan(oldFixedFloor) // reproduces the old bug: rect silently dropped

    const minSizeAtZoom = pxToNormTolerance(MIN_RECT_SIZE_PX, zoomedWidthPx)
    expect(dragNormAtZoom).toBeGreaterThan(minSizeAtZoom) // fixed: same screen drag now clears the floor

    // And the floor doesn't get so loose at base zoom that a real misclick (a
    // couple of px of mouse jitter) starts registering as a rectangle.
    const jitterNormAtBase = 2 / baseWidthPx
    const minSizeAtBase = pxToNormTolerance(MIN_RECT_SIZE_PX, baseWidthPx)
    expect(jitterNormAtBase).toBeLessThan(minSizeAtBase)
  })
})

describe('pointInPolygon', () => {
  const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]

  it('returns true for a point inside the polygon', () => {
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, square)).toBe(true)
  })
  it('returns false for a point outside the polygon', () => {
    expect(pointInPolygon({ x: 1.5, y: 0.5 }, square)).toBe(false)
  })
  it('returns true for a non-convex (triangle) shape', () => {
    const triangle = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }]
    expect(pointInPolygon({ x: 0.5, y: 0.3 }, triangle)).toBe(true)
    expect(pointInPolygon({ x: 0.05, y: 0.9 }, triangle)).toBe(false)
  })
})

describe('areaM2', () => {
  it('retourne 100 pour un carré de 10m × 10m (normalisé, image 1000×1000px, gsd 0.01 m/px)', () => {
    // Image 1000×1000px, gsd 0.01 m/px → chaque px = 1 cm → 1000px = 10m
    // Carré normalisé : (0,0) (1,0) (1,1) (0,1)
    const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
    expect(areaM2(square, 1000, 1000, { x: 0.01, y: 0.01 })).toBeCloseTo(100)
  })
  it('retourne 50 pour un triangle rectangle de base 10m × hauteur 10m', () => {
    const triangle = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
    expect(areaM2(triangle, 1000, 1000, { x: 0.01, y: 0.01 })).toBeCloseTo(50)
  })
})
