export interface Point { x: number; y: number }

/** True if `b` is within `toleranceNorm` (normalized 0–1 units) of `a`. */
export function isNearPoint(a: Point, b: Point, toleranceNorm: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= toleranceNorm
}

/**
 * Converts a fixed on-screen pixel tolerance into normalized (0–1) units for the
 * current rendered width. Normalized units stay fixed across zoom levels while the
 * rendered width grows with zoom — without this conversion, a "near point" tolerance
 * expressed directly in normalized units balloons in screen pixels as the user zooms in.
 */
export function pxToNormTolerance(pxTolerance: number, renderedWidthPx: number): number {
  return pxTolerance / renderedWidthPx
}

/** Arithmetic mean of a list of normalized points. */
export function centroid(points: Point[]): Point {
  const n = points.length
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / n, y: sum.y / n }
}

/** Ray-casting (even-odd rule) point-in-polygon test. Coordinate space agnostic. */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersects = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/**
 * Surface en m² d'un polygone en coordonnées normalisées (0–1).
 * @param points   Sommets normalisés (0–1) dans le système de coordonnées image.
 * @param imgW     Largeur de l'image stockée en pixels (naturalWidth).
 * @param imgH     Hauteur de l'image stockée en pixels (naturalHeight).
 * @param gsd      Résolution sol en mètres/pixel de l'image stockée.
 */
export function areaM2(
  points: Point[],
  imgW: number,
  imgH: number,
  gsd: { x: number; y: number },
): number {
  let area = 0
  const n = points.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x * imgW * gsd.x
    const yi = points[i].y * imgH * gsd.y
    const xj = points[j].x * imgW * gsd.x
    const yj = points[j].y * imgH * gsd.y
    area += (xj + xi) * (yj - yi)
  }
  return Math.abs(area) / 2
}
