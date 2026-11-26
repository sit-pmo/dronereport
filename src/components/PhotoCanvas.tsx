import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import type { PhotoAnnotation, Measure } from '../types'
import { isNearPoint, centroid, pointInPolygon, pxToNormTolerance, areaM2, type Point } from '../lib/polygonGeometry'
import { PV_ANOMALY_TYPES, PV_CUSTOM_SHAPE, PV_CUSTOM_COLOR, SEVERITY_COLORS, type AnomalyShape } from '../lib/constants'
import { formatDist, formatArea } from '../lib/measureFormat'

interface Props {
  imageUrl: string
  annotations: PhotoAnnotation[]
  activeTool: 'pin' | 'rect' | 'polygon' | 'pan' | 'measure-line' | 'measure-polygon'
  selectedId?: string | null
  isPV?: boolean
  onAdd: (ann: Omit<PhotoAnnotation, 'id' | 'label'>) => void
  onMove: (id: string, x: number, y: number) => void
  onSelect?: (id: string) => void
  // Espace+molette par défaut — évite de capter le zoom natif Ctrl/Cmd+molette
  // du navigateur sur l'outil pilote (decision 2026-06-21). Le viewer public
  // (ReportView.tsx) n'a pas cette contrainte et préfère la molette seule —
  // pas de page de réglages pilote à apprendre pour un commanditaire qui ouvre
  // un lien une fois.
  requireSpaceForZoom?: boolean
  // Measure tool props
  measurements?: Measure[]
  onMeasure?: (m: Measure) => void
  onMeasureDelete?: (id: string) => void
  groundResolution?: { x: number; y: number }
  viewerMeasureIds?: Set<string>
}

type RectDraft = { x: number; y: number; w: number; h: number }
type AnnDrag = { id: string; origX: number; origY: number; startX: number; startY: number }
type PanDrag = { startX: number; startY: number; scrollLeft: number; scrollTop: number; hitId: string | null }

// Double anneau blanc+navy : visible quel que soit la couleur du fond (ortho
// claire ou thermique sombre), contrairement à un simple anneau semi-transparent.
const HALO_SHADOW = '0 0 0 2px #ffffff, 0 0 0 6px #1a2e44'

// Étoile à 5 branches, viewBox 0–16 (même grille que les 4 autres figurés).
const STAR_POINTS = '8,1.5 9.5,5.9 14.2,6 10.5,8.8 11.8,13.3 8,10.6 4.2,13.3 5.5,8.8 1.8,6 6.5,5.9'

const CLOSE_TOLERANCE_PX = 12
export const MIN_RECT_SIZE_PX = 8
const MIN_SCALE = 1
const MAX_SCALE = 10
const ZOOM_STEP = 0.5
const CLICK_TOLERANCE_PX = 5

const MEASURE_HIT_PX = 10 // distance max en pixels pour cliquer sur une ligne de mesure

// Distance d'un point normalisé à un segment normalisé, en pixels rendus.
function distToSegmentPx(p: Point, a: Point, b: Point, cW: number, cH: number): number {
  const px = p.x * cW, py = p.y * cH
  const ax = a.x * cW, ay = a.y * cH
  const bx = b.x * cW, by = b.y * cH
  const abx = bx - ax, aby = by - ay
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2))
  return Math.hypot(px - ax - t * abx, py - ay - t * aby)
}

export default function PhotoCanvas({ imageUrl, annotations, activeTool, selectedId, isPV, onAdd, onMove, onSelect, requireSpaceForZoom = true, measurements, onMeasure, onMeasureDelete, groundResolution, viewerMeasureIds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rectDraft, setRectDraft] = useState<RectDraft | null>(null)
  const [polygonDraft, setPolygonDraft] = useState<Point[] | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [scale, setScale] = useState(1)

  // Refs hold live drag state — avoids stale closures in window handlers
  const rectStart = useRef<{ x: number; y: number } | null>(null)
  const annDragRef = useRef<AnnDrag | null>(null)
  const panDragRef = useRef<PanDrag | null>(null)
  const onAddRef = useRef(onAdd)
  const onMoveRef = useRef(onMove)
  const onSelectRef = useRef(onSelect)
  const spacePressed = useRef(false)
  const scaleRef = useRef(1)
  const pendingScroll = useRef<{ left: number; top: number } | null>(null)
  onAddRef.current = onAdd
  onMoveRef.current = onMove
  onSelectRef.current = onSelect
  scaleRef.current = scale

  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null)
  const [measureLineDraft, setMeasureLineDraft] = useState<Point | null>(null)
  const [hoverNorm, setHoverNorm] = useState<Point | null>(null)
  const [selectedMeasureId, setSelectedMeasureId] = useState<string | null>(null)
  const onMeasureRef = useRef(onMeasure)
  const onMeasureDeleteRef = useRef(onMeasureDelete)
  onMeasureRef.current = onMeasure
  onMeasureDeleteRef.current = onMeasureDelete

  // Apply the scroll position computed in onWheel only after the DOM has
  // resized for the new scale — setting it earlier would clamp against the
  // old (smaller) scrollWidth/scrollHeight. Runs before paint, so no flicker.
  useLayoutEffect(() => {
    if (pendingScroll.current && scrollRef.current) {
      scrollRef.current.scrollLeft = pendingScroll.current.left
      scrollRef.current.scrollTop = pendingScroll.current.top
      pendingScroll.current = null
    }
  }, [scale])

  // Track Space to gate wheel-zoom (avoids hijacking Ctrl/Cmd+wheel, which is the
  // browser's own page-zoom shortcut)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') spacePressed.current = true
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spacePressed.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Native (non-passive) wheel listener — React's onWheel is passive by default,
  // so preventDefault() inside it silently fails to stop the container's native
  // scroll while Space is held to zoom instead.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (requireSpaceForZoom && !spacePressed.current) return
      e.preventDefault()
      const oldScale = scaleRef.current
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale - e.deltaY * 0.0015))
      if (newScale === oldScale) return

      // Keep the point under the cursor stationary: find what fraction of the
      // scaled content it sits at, then re-derive scroll offsets so that same
      // point lands back under the cursor at the new scale.
      const scrollEl = scrollRef.current!
      const viewportRect = scrollEl.getBoundingClientRect()
      const mouseX = e.clientX - viewportRect.left
      const mouseY = e.clientY - viewportRect.top
      const ratio = newScale / oldScale
      pendingScroll.current = {
        left: (scrollEl.scrollLeft + mouseX) * ratio - mouseX,
        top: (scrollEl.scrollTop + mouseY) * ratio - mouseY,
      }
      setScale(newScale)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function getNorm(clientX: number, clientY: number) {
    const r = containerRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    }
  }

  // Hit-tests the whole shape body (not just the small numbered badge) so rect/polygon
  // annotations can be grabbed anywhere inside them, not only by their corner/centroid badge.
  // Checked topmost-first (reverse render order) so overlapping shapes pick the one on top.
  function findAnnotationAt(clientX: number, clientY: number): PhotoAnnotation | null {
    const r = containerRef.current!.getBoundingClientRect()
    const px = clientX - r.left
    const py = clientY - r.top
    const n = { x: px / r.width, y: py / r.height }
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i]
      if (ann.type === 'rect') {
        if (n.x >= ann.x && n.x <= ann.x + (ann.w ?? 0) && n.y >= ann.y && n.y <= ann.y + (ann.h ?? 0)) return ann
      } else if (ann.type === 'polygon' && ann.points) {
        if (pointInPolygon(n, ann.points)) return ann
      }
      if (Math.hypot(px - ann.x * r.width, py - ann.y * r.height) <= 16) return ann
    }
    return null
  }

  function findMeasureAt(clientX: number, clientY: number): Measure | null {
    if (!measurements?.length) return null
    const r = containerRef.current!.getBoundingClientRect()
    const n = { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height }
    const cW = r.width, cH = r.height
    // Check in reverse order (topmost first)
    for (let i = (measurements.length - 1); i >= 0; i--) {
      const m = measurements[i]
      if (m.kind === 'line') {
        const a = { x: m.x1, y: m.y1 }, b = { x: m.x2, y: m.y2 }
        if (distToSegmentPx(n, a, b, cW, cH) <= MEASURE_HIT_PX) return m
      } else if (m.kind === 'polygon') {
        if (pointInPolygon(n, m.points)) return m
      }
    }
    return null
  }

  // Reset any in-progress polygon when the tool changes
  useEffect(() => {
    setPolygonDraft(null)
    setSelectedMeasureId(null)
    if (activeTool !== 'measure-line') { setMeasureLineDraft(null); setHoverNorm(null) }
  }, [activeTool])

  function commitMeasurePolygon(pts: Point[]) {
    const nat = imgNatural
    const gsd = groundResolution
    if (!nat || !gsd || pts.length < 3) return
    const segmentsM = pts.map((p, i) => {
      const next = pts[(i + 1) % pts.length]
      const dx = (next.x - p.x) * nat.w * gsd.x
      const dy = (next.y - p.y) * nat.h * gsd.y
      return Math.hypot(dx, dy)
    })
    const area = areaM2(pts, nat.w, nat.h, gsd)
    onMeasureRef.current?.({
      id: crypto.randomUUID(),
      kind: 'polygon',
      points: pts,
      segmentsM,
      areaM2: area,
    })
  }

  // Enter closes the in-progress polygon (if it has ≥3 points), Escape cancels it
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!polygonDraft) return
      if (e.key === 'Enter' && polygonDraft.length >= 3) {
        if (activeTool === 'measure-polygon') {
          commitMeasurePolygon(polygonDraft)
        } else {
          onAddRef.current({ type: 'polygon', severity: 'faible', points: polygonDraft, ...centroid(polygonDraft) })
        }
        setPolygonDraft(null)
      } else if (e.key === 'Escape') {
        setPolygonDraft(null)
        setMeasureLineDraft(null)
        setHoverNorm(null)
      } else if (e.key === 'Backspace' && activeTool === 'measure-polygon' && polygonDraft.length > 0) {
        e.preventDefault()
        setPolygonDraft(prev => prev ? prev.slice(0, -1) : null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [polygonDraft, activeTool, imgNatural, groundResolution]) // imgNatural + groundResolution needed for commitMeasurePolygon

  // Global mousemove + mouseup — ensures drag completes even when mouse exits container
  useEffect(() => {
    function onGlobalMove(e: MouseEvent) {
      if (panDragRef.current && scrollRef.current) {
        const drag = panDragRef.current
        scrollRef.current.scrollLeft = drag.scrollLeft - (e.clientX - drag.startX)
        scrollRef.current.scrollTop = drag.scrollTop - (e.clientY - drag.startY)
      }
      if (rectStart.current) {
        const n = getNorm(e.clientX, e.clientY)
        const s = rectStart.current
        setRectDraft({ x: Math.min(s.x, n.x), y: Math.min(s.y, n.y), w: Math.abs(n.x - s.x), h: Math.abs(n.y - s.y) })
      }
      if (annDragRef.current) {
        setDragPos(getNorm(e.clientX, e.clientY))
      }
    }

    function onGlobalUp(e: MouseEvent) {
      if (panDragRef.current) {
        const drag = panDragRef.current
        panDragRef.current = null
        const moved = Math.abs(e.clientX - drag.startX) > CLICK_TOLERANCE_PX || Math.abs(e.clientY - drag.startY) > CLICK_TOLERANCE_PX
        if (!moved && drag.hitId) onSelectRef.current?.(drag.hitId)
      }
      if (rectStart.current) {
        const n = getNorm(e.clientX, e.clientY)
        const s = rectStart.current
        rectStart.current = null
        setRectDraft(null)
        const d = { x: Math.min(s.x, n.x), y: Math.min(s.y, n.y), w: Math.abs(n.x - s.x), h: Math.abs(n.y - s.y) }
        const r = containerRef.current!.getBoundingClientRect()
        const minW = pxToNormTolerance(MIN_RECT_SIZE_PX, r.width)
        const minH = pxToNormTolerance(MIN_RECT_SIZE_PX, r.height)
        if (d.w > minW && d.h > minH) onAddRef.current({ type: 'rect', severity: 'faible', ...d })
      }
      if (annDragRef.current) {
        const drag = annDragRef.current
        const n = getNorm(e.clientX, e.clientY)
        annDragRef.current = null
        setDragPos(null)
        onMoveRef.current(
          drag.id,
          Math.max(0, Math.min(1, drag.origX + n.x - drag.startX)),
          Math.max(0, Math.min(1, drag.origY + n.y - drag.startY)),
        )
      }
    }

    window.addEventListener('mousemove', onGlobalMove)
    window.addEventListener('mouseup', onGlobalUp)
    return () => {
      window.removeEventListener('mousemove', onGlobalMove)
      window.removeEventListener('mouseup', onGlobalUp)
    }
  }, []) // intentional empty deps — handlers use refs for fresh values

  function handleMouseDown(e: React.MouseEvent) {
    if (activeTool === 'pan') {
      e.preventDefault()
      const el = scrollRef.current
      const hit = findAnnotationAt(e.clientX, e.clientY)
      if (el) panDragRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, hitId: hit?.id ?? null }
      return
    }

    // Measure tools don't drag annotations
    if (activeTool === 'measure-line' || activeTool === 'measure-polygon') return

    // Drag an existing annotation (grab anywhere on its body, any tool mode)
    const hit = findAnnotationAt(e.clientX, e.clientY)
    if (hit) {
      e.preventDefault()
      const n = getNorm(e.clientX, e.clientY)
      annDragRef.current = { id: hit.id, origX: hit.x, origY: hit.y, startX: n.x, startY: n.y }
      return
    }
    if (activeTool === 'rect') {
      e.preventDefault()
      rectStart.current = getNorm(e.clientX, e.clientY)
    }
  }

  function handleClick(e: React.MouseEvent) {
    // Deselect measure on any click (if not on a measure — checked inside each tool branch)
    if (activeTool !== 'measure-line' && activeTool !== 'measure-polygon') {
      setSelectedMeasureId(null)
    }

    if (activeTool !== 'measure-line' && activeTool !== 'measure-polygon') {
      if (findAnnotationAt(e.clientX, e.clientY)) return // don't place a new annotation on top of an existing one
    }

    if (activeTool === 'pin') {
      const n = getNorm(e.clientX, e.clientY)
      onAdd({ type: 'pin', severity: 'faible', x: n.x, y: n.y })
      return
    }

    if (activeTool === 'polygon') {
      const n = getNorm(e.clientX, e.clientY)
      const closeTolerance = pxToNormTolerance(CLOSE_TOLERANCE_PX, containerRef.current!.getBoundingClientRect().width)
      if (polygonDraft && polygonDraft.length >= 3 && isNearPoint(polygonDraft[0], n, closeTolerance)) {
        onAdd({ type: 'polygon', severity: 'faible', points: polygonDraft, ...centroid(polygonDraft) })
        setPolygonDraft(null)
        return
      }
      setPolygonDraft([...(polygonDraft ?? []), n])
    }

    if (activeTool === 'measure-line') {
      const n = getNorm(e.clientX, e.clientY)
      // Click on existing measure = select (only if deletable by current user)
      const hit = findMeasureAt(e.clientX, e.clientY)
      if (hit) { if (!viewerMeasureIds || viewerMeasureIds.has(hit.id)) setSelectedMeasureId(hit.id); setMeasureLineDraft(null); setHoverNorm(null); return }
      if (!measureLineDraft) {
        setMeasureLineDraft(n)
        return
      }
      // Second click = commit line
      const nat = imgNatural, gsd = groundResolution
      if (nat && gsd) {
        const dx = (n.x - measureLineDraft.x) * nat.w * gsd.x
        const dy = (n.y - measureLineDraft.y) * nat.h * gsd.y
        onMeasureRef.current?.({
          id: crypto.randomUUID(),
          kind: 'line',
          x1: measureLineDraft.x, y1: measureLineDraft.y,
          x2: n.x, y2: n.y,
          distanceM: Math.hypot(dx, dy),
        })
      }
      setMeasureLineDraft(null)
      setHoverNorm(null)
      return
    }

    if (activeTool === 'measure-polygon') {
      const n = getNorm(e.clientX, e.clientY)
      const hit = findMeasureAt(e.clientX, e.clientY)
      if (hit) { if (!viewerMeasureIds || viewerMeasureIds.has(hit.id)) setSelectedMeasureId(hit.id); setPolygonDraft(null); return }
      const closeTolerance = pxToNormTolerance(CLOSE_TOLERANCE_PX, containerRef.current!.getBoundingClientRect().width)
      if (polygonDraft && polygonDraft.length >= 3 && isNearPoint(polygonDraft[0], n, closeTolerance)) {
        commitMeasurePolygon(polygonDraft)
        setPolygonDraft(null)
        return
      }
      setPolygonDraft([...(polygonDraft ?? []), n])
      return
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (activeTool === 'measure-line' && measureLineDraft) {
      setHoverNorm(getNorm(e.clientX, e.clientY))
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={scrollRef} style={{ overflow: 'auto', maxHeight: '70vh' }}>
        <div
          ref={containerRef}
          style={{ position: 'relative', width: `${scale * 100}%`, userSelect: 'none', cursor: activeTool === 'pan' ? 'grab' : 'crosshair' }}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
        >
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', display: 'block' }}
            draggable={false}
            onLoad={(e) => setImgNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />

          {rectDraft && (
            <div style={{
              position: 'absolute',
              left: `${rectDraft.x * 100}%`, top: `${rectDraft.y * 100}%`,
              width: `${rectDraft.w * 100}%`, height: `${rectDraft.h * 100}%`,
              border: '2px dashed #ef4444', background: 'rgba(239,68,68,0.1)',
              pointerEvents: 'none', boxSizing: 'border-box',
            }} />
          )}

          {polygonDraft && polygonDraft.length > 0 && (
            <>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <polyline
                  points={polygonDraft.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                  fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke"
                />
              </svg>
              {polygonDraft.map((p, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${p.x * 100}%`, top: `${p.y * 100}%`,
                  width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5,
                  borderRadius: '50%', boxSizing: 'border-box',
                  background: i === 0 ? '#ef4444' : '#fff', border: '1.5px solid #ef4444',
                  pointerEvents: 'none',
                }} />
              ))}
            </>
          )}

          {annotations.map((ann, i) => {
            const isMoving = annDragRef.current?.id === ann.id
            const dx = isMoving && dragPos
              ? Math.max(0, Math.min(1, ann.x + dragPos.x - annDragRef.current!.startX))
              : ann.x
            const dy = isMoving && dragPos
              ? Math.max(0, Math.min(1, ann.y + dragPos.y - annDragRef.current!.startY))
              : ann.y
            const num = i + 1
            const isSelected = ann.id === selectedId
            const badgeSize = isPV ? 16 : 24
            const pvType = isPV ? PV_ANOMALY_TYPES.find((t) => t.label === ann.label) : undefined
            const isEmpty = isPV && !ann.label
            // Texte libre tapé sans cliquer un type fixe : pas incomplet, juste une
            // anomalie décrite à sa façon — étoile dédiée (voir légende), pas le
            // pointillé "rien renseigné encore".
            const isCustom = isPV && !pvType && !isEmpty
            const badgeShape = pvType?.shape ?? (isCustom ? PV_CUSTOM_SHAPE : undefined)
            const typeColor = pvType?.color ?? (isCustom ? PV_CUSTOM_COLOR : undefined)
            // PV : un figuré ET une couleur fixes par type identifient l'anomalie (pas la
            // sévérité — devenue illisible dès qu'un rectangle/polygone partage la même
            // sévérité que d'autres types). Sélection = halo navy, pas un remplissage.
            // Tant que rien n'est renseigné, gris pointillé neutre.
            // Toiture inchangée (pas de système figuré/couleur par type).
            const sevColor = SEVERITY_COLORS[ann.severity] ?? '#ef4444'
            const color = isPV ? (isEmpty ? '#9ca3af' : typeColor!) : (isSelected ? '#1a2e44' : sevColor)
            const fill = isPV ? (isEmpty ? 'rgba(156,163,175,0.08)' : hexToRgba(typeColor!, 0.15)) : (isSelected ? 'rgba(26,46,68,0.15)' : hexToRgba(sevColor, 0.15))
            const halo = isPV && isSelected
            const dashed = isEmpty ? '4 3' : undefined

            if (ann.type === 'rect') {
              return (
                <div key={ann.id} style={{
                  position: 'absolute',
                  left: `${dx * 100}%`, top: `${dy * 100}%`,
                  width: `${(ann.w ?? 0) * 100}%`, height: `${(ann.h ?? 0) * 100}%`,
                  pointerEvents: 'none', boxSizing: 'border-box',
                }}>
                  <div style={{ position: 'absolute', inset: 0, border: `2.5px ${isEmpty ? 'dashed' : 'solid'} ${color}`, background: fill, borderRadius: 3, boxShadow: halo ? HALO_SHADOW : undefined }} />
                  {/* Pas de figuré ponctuel sur une forme déjà surfacique en PV — la couleur
                      de la forme suffit. Conservé pour Toiture (numéro = repère vers la liste). */}
                  {!isPV && <NumberBadge num={num} selected={isSelected} size={badgeSize} pv={isPV} shape={badgeShape} typeColor={typeColor} badgeColor={sevColor} />}
                </div>
              )
            }

            if (ann.type === 'polygon' && ann.points) {
              const shiftX = isMoving ? dx - ann.x : 0
              const shiftY = isMoving ? dy - ann.y : 0
              const pts = ann.points.map((p) => `${(p.x + shiftX) * 100},${(p.y + shiftY) * 100}`).join(' ')
              return (
                <div key={ann.id} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    {halo && (
                      <>
                        <polygon points={pts} fill="none" stroke="#1a2e44" strokeWidth={9} vectorEffect="non-scaling-stroke" />
                        <polygon points={pts} fill="none" stroke="#ffffff" strokeWidth={6} vectorEffect="non-scaling-stroke" />
                      </>
                    )}
                    <polygon points={pts} fill={fill} stroke={color} strokeWidth={2.5} strokeDasharray={dashed} vectorEffect="non-scaling-stroke" />
                  </svg>
                  {!isPV && (
                    <div style={{ position: 'absolute', left: `${dx * 100}%`, top: `${dy * 100}%`, transform: 'translate(-50%, -50%)' }}>
                      <NumberBadge num={num} selected={isSelected} size={badgeSize} pv={isPV} shape={badgeShape} typeColor={typeColor} badgeColor={sevColor} />
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div key={ann.id} style={{
                position: 'absolute',
                left: `${dx * 100}%`, top: `${dy * 100}%`,
                transform: 'translate(-50%, -50%)', pointerEvents: 'none',
              }}>
                <NumberBadge num={num} selected={isSelected} size={badgeSize} pv={isPV} shape={badgeShape} typeColor={typeColor} badgeColor={sevColor} />
              </div>
            )
          })}

          {/* Mesures */}
          {measurements && measurements.length > 0 && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {measurements.map((m) => {
                const isViewer = viewerMeasureIds?.has(m.id) ?? false
                const color = isViewer ? '#c07828' : '#1a2e44'
                const isSelected = m.id === selectedMeasureId
                if (m.kind === 'line') {
                  return (
                    <g key={m.id}>
                      {isSelected && <line x1={m.x1 * 100} y1={m.y1 * 100} x2={m.x2 * 100} y2={m.y2 * 100} stroke="#ffffff" strokeWidth={9} vectorEffect="non-scaling-stroke" />}
                      <line x1={m.x1 * 100} y1={m.y1 * 100} x2={m.x2 * 100} y2={m.y2 * 100} stroke="#ffffff" strokeWidth={4} vectorEffect="non-scaling-stroke" />
                      <line x1={m.x1 * 100} y1={m.y1 * 100} x2={m.x2 * 100} y2={m.y2 * 100} stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    </g>
                  )
                } else {
                  const pts = m.points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')
                  return (
                    <g key={m.id}>
                      {isSelected && <polygon points={pts} fill="none" stroke="#ffffff" strokeWidth={9} vectorEffect="non-scaling-stroke" />}
                      <polygon points={pts} fill={`${color}22`} stroke="#ffffff" strokeWidth={4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <polygon points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </g>
                  )
                }
              })}
            </svg>
          )}

          {/* Labels distance/surface sur les mesures
              Tous positionnés directement dans le container (position absolute en %
              du container), pas dans un div intermédiaire — évite que left/top %
              soit relatif à un div auto-sized plutôt qu'au container pleine largeur. */}
          {measurements?.flatMap((m) => {
            const isViewer = viewerMeasureIds?.has(m.id) ?? false
            const color = isViewer ? '#c07828' : '#1a2e44'
            const isSelected = m.id === selectedMeasureId
            const isDeletable = !viewerMeasureIds || viewerMeasureIds.has(m.id)
            const baseLabel: React.CSSProperties = {
              position: 'absolute',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.92)',
              color,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'sans-serif',
              padding: '1px 4px',
              borderRadius: 3,
              border: `1px solid ${color}`,
              whiteSpace: 'nowrap',
            }

            if (m.kind === 'line') {
              const mx = (m.x1 + m.x2) / 2, my = (m.y1 + m.y2) / 2
              return [(
                <div key={m.id} style={{
                  ...baseLabel, left: `${mx * 100}%`, top: `${my * 100}%`,
                  pointerEvents: isSelected && isDeletable ? 'auto' : 'none',
                  cursor: isSelected && isDeletable ? 'pointer' : 'default',
                }}
                  onClick={isSelected && isDeletable ? (e) => { e.stopPropagation(); onMeasureDeleteRef.current?.(m.id) } : undefined}
                  title={isSelected && isDeletable ? 'Cliquer pour supprimer' : undefined}
                >
                  {formatDist(m.distanceM)}{isSelected && isDeletable ? ' ✕' : ''}
                </div>
              )]
            } else {
              const c = centroid(m.points)
              const segLabels = m.points.map((p, i) => {
                const next = m.points[(i + 1) % m.points.length]
                const smx = (p.x + next.x) / 2, smy = (p.y + next.y) / 2
                return (
                  <div key={`${m.id}-s${i}`} style={{ ...baseLabel, left: `${smx * 100}%`, top: `${smy * 100}%`, pointerEvents: 'none' }}>
                    {formatDist(m.segmentsM[i])}
                  </div>
                )
              })
              const areaLabel = (
                <div key={`${m.id}-area`} style={{
                  ...baseLabel, left: `${c.x * 100}%`, top: `${c.y * 100}%`,
                  pointerEvents: isSelected && isDeletable ? 'auto' : 'none',
                  cursor: isSelected && isDeletable ? 'pointer' : 'default',
                }}
                  onClick={isSelected && isDeletable ? (e) => { e.stopPropagation(); onMeasureDeleteRef.current?.(m.id) } : undefined}
                  title={isSelected && isDeletable ? 'Cliquer pour supprimer' : undefined}
                >
                  {formatArea(m.areaM2)}{isSelected && isDeletable ? ' ✕' : ''}
                </div>
              )
              return [...segLabels, areaLabel]
            }
          })}

          {/* Preview ligne en cours (measure-line, après 1er clic) */}
          {activeTool === 'measure-line' && measureLineDraft && hoverNorm && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <line
                x1={measureLineDraft.x * 100} y1={measureLineDraft.y * 100}
                x2={hoverNorm.x * 100} y2={hoverNorm.y * 100}
                stroke="white" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          {/* Label distance live pendant tracé measure-line */}
          {activeTool === 'measure-line' && measureLineDraft && hoverNorm && imgNatural && groundResolution && (() => {
            const dx = (hoverNorm.x - measureLineDraft.x) * imgNatural.w * groundResolution.x
            const dy = (hoverNorm.y - measureLineDraft.y) * imgNatural.h * groundResolution.y
            const dist = Math.hypot(dx, dy)
            const mx = (measureLineDraft.x + hoverNorm.x) / 2
            const my = (measureLineDraft.y + hoverNorm.y) / 2
            return (
              <div style={{
                position: 'absolute',
                left: `${mx * 100}%`,
                top: `${my * 100}%`,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255,255,255,0.85)',
                borderRadius: 4,
                padding: '1px 5px',
                fontSize: 11,
                fontWeight: 600,
                color: '#1a2e44',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}>
                {formatDist(dist)}
              </div>
            )
          })()}

          {/* Hint bar contextuelle (modes mesure) */}
          {(() => {
            let hint: string | null = null
            if (activeTool === 'measure-line') {
              hint = measureLineDraft
                ? 'Cliquez pour terminer · Échap pour annuler'
                : 'Cliquez pour poser le point de départ'
            } else if (activeTool === 'measure-polygon') {
              hint = polygonDraft && polygonDraft.length > 0
                ? 'Cliquez pour continuer · 1er point ou Entrée pour fermer · Échap pour annuler'
                : 'Cliquez pour ajouter le premier sommet'
            }
            if (!hint) return null
            const perimeterM = (activeTool === 'measure-polygon' && polygonDraft && polygonDraft.length >= 2 && imgNatural && groundResolution)
              ? polygonDraft.slice(1).reduce((acc, pt, i) => {
                  const dx = (pt.x - polygonDraft[i].x) * imgNatural.w * groundResolution.x
                  const dy = (pt.y - polygonDraft[i].y) * imgNatural.h * groundResolution.y
                  return acc + Math.hypot(dx, dy)
                }, 0)
              : null
            return (
              <div style={{
                position: 'sticky',
                bottom: 0,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: 12,
                color: '#fff',
                background: 'rgba(0,0,0,0.45)',
                padding: '3px 8px',
                pointerEvents: 'none',
                lineHeight: 1.6,
              }}>
                {hint}
                {perimeterM !== null && (
                  <><br />{`Périmètre en cours : ${formatDist(perimeterM)}`}</>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      <div style={zoomControls.wrap} title="Astuce : Espace + molette pour zoomer">
        <button onClick={() => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP))} style={zoomControls.btn} aria-label="Dézoomer">−</button>
        <span style={zoomControls.label}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP))} style={zoomControls.btn} aria-label="Zoomer">+</button>
      </div>
    </div>
  )
}

const zoomControls: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', bottom: 10, right: 10, display: 'flex', alignItems: 'center', gap: 2,
    background: 'rgba(15,26,37,0.85)', borderRadius: 8, padding: 4,
  },
  btn: {
    width: 28, height: 28, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', lineHeight: 1,
  },
  label: { color: '#fff', fontSize: 11, minWidth: 38, textAlign: 'center', fontFamily: 'inherit' },
}

function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

// Silhouette par type d'anomalie PV — symbologie catégorisée façon SIG (rond/carré/
// triangle/losange), plus robuste à 16px qu'une lettre (H/B/C se confondaient).
// Pas de remplissage : un figuré ponctuel ne doit pas masquer l'ortho thermique
// sous le point exact qu'il signale — seul le contour porte la couleur du type.
// Liseré blanc sous le trait coloré : sans lui, un figuré ton-sur-ton avec l'ortho
// (ex. ambre sur toiture claire) devient quasi invisible.
function ShapeGlyph({ shape, color }: { shape: AnomalyShape; color: string }) {
  const haloWidth = 3.5
  const strokeWidth = 1.8
  if (shape === 'circle') return (
    <>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="#ffffff" strokeWidth={haloWidth} />
      <circle cx="8" cy="8" r="6.5" fill="none" stroke={color} strokeWidth={strokeWidth} />
    </>
  )
  if (shape === 'square') return (
    <>
      <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="#ffffff" strokeWidth={haloWidth} />
      <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke={color} strokeWidth={strokeWidth} />
    </>
  )
  if (shape === 'diamond') return (
    <>
      <polygon points="8,1 15,8 8,15 1,8" fill="none" stroke="#ffffff" strokeWidth={haloWidth} strokeLinejoin="round" />
      <polygon points="8,1 15,8 8,15 1,8" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </>
  )
  if (shape === 'star') return (
    <>
      <polygon points={STAR_POINTS} fill="none" stroke="#ffffff" strokeWidth={haloWidth} strokeLinejoin="round" />
      <polygon points={STAR_POINTS} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </>
  )
  return (
    <>
      <polygon points="8,1.5 15,14.5 1,14.5" fill="none" stroke="#ffffff" strokeWidth={haloWidth} strokeLinejoin="round" />
      <polygon points="8,1.5 15,14.5 1,14.5" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </>
  )
}

function NumberBadge({ num, selected, size = 24, pv, shape, typeColor, badgeColor }: { num: number; selected?: boolean; size?: number; pv?: boolean; shape?: AnomalyShape; typeColor?: string; badgeColor?: string }) {
  const small = size < 24

  if (pv) {
    const halo = selected ? HALO_SHADOW : 'none'
    if (!shape) {
      // Aucun type choisi encore (label vide) : neutre, pas de "Faible" présumé.
      return <div style={{ width: size, height: size, borderRadius: '50%', background: 'transparent', border: '1.5px dashed #9ca3af', boxShadow: halo, cursor: 'grab' }} />
    }
    // Forme = type d'anomalie, couleur = sévérité, sélection = halo navy
    // (pas de lettre/numéro — l'identité complète est à un clic dans la liste).
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', cursor: 'grab', boxShadow: halo }}>
        <svg viewBox="0 0 16 16" width={size} height={size} style={{ display: 'block' }}>
          <ShapeGlyph shape={shape} color={typeColor ?? '#5a7083'} />
        </svg>
      </div>
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: selected ? '#1a2e44' : (badgeColor ?? '#ef4444'), border: `${small ? 1.5 : 2}px solid white`,
      color: 'white', fontSize: small ? 9 : 11, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'sans-serif',
      boxShadow: selected ? '0 0 0 4px rgba(26,46,68,0.35), 0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.3)',
      cursor: 'grab',
    }}>
      {num}
    </div>
  )
}
