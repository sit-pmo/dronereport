import { useRef, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { PhotoAnnotation, SeverityLevel } from '../types'
import { saveDraft, updateDraftPhotos } from '../lib/reportDraft'
import { SEVERITY_LABELS, SEVERITY_COLORS, getRoofAnomalyTypes } from '../lib/constants'
import { useDraft } from '../hooks/useDraft'
import PhotoCanvas from '../components/PhotoCanvas'

const TOOL_LABELS = { pin: '📍 Point', rect: '🔲 Rectangle', polygon: '🔺 Polygone', pan: '✋ Main' } as const

export default function AnnotateTerrain() {
  const navigate = useNavigate()
  const { photoId } = useParams<{ photoId: string }>()
  const { draft, setDraft } = useDraft()
  const [activeTool, setActiveTool] = useState<'pin' | 'rect' | 'polygon' | 'pan'>('pin')
  const [pendingLabelId, setPendingLabelId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])

  const photo = draft?.photos?.find((p) => p.id === photoId)
  const annotations = photo?.annotations ?? []
  const anomalyTypes = getRoofAnomalyTypes(draft?.mission?.materiauToiture)

  useEffect(() => {
    if (draft && !photo?.storageUrl) navigate('/photos-terrain')
  }, [draft]) // eslint-disable-line react-hooks/exhaustive-deps

  function saveAnnotations(updated: PhotoAnnotation[]) {
    const d = draftRef.current
    if (!d || !photoId) return
    const photos = (d.photos ?? []).map((p) => p.id === photoId ? { ...p, annotations: updated } : p)
    const next = updateDraftPhotos(d, photos)
    saveDraft(next)
    setDraft(next)
  }

  function addAnnotation(ann: Omit<PhotoAnnotation, 'id' | 'label'>) {
    const newAnn: PhotoAnnotation = { ...ann, id: crypto.randomUUID(), label: '' }
    saveAnnotations([...annotations, newAnn])
    setPendingLabelId(newAnn.id)
    setExpandedId(newAnn.id)
  }

  function updateAnnotation(id: string, patch: Partial<PhotoAnnotation>) {
    saveAnnotations(annotations.map((a) => a.id === id ? { ...a, ...patch } : a))
  }

  function moveAnnotation(id: string, x: number, y: number) {
    saveAnnotations(annotations.map((a) => {
      if (a.id !== id) return a
      if (a.type === 'polygon' && a.points) {
        const dx = x - a.x
        const dy = y - a.y
        return { ...a, x, y, points: a.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
      }
      return { ...a, x, y }
    }))
  }

  function deleteAnnotation(id: string) {
    saveAnnotations(annotations.filter((a) => a.id !== id))
  }

  if (!photo?.storageUrl) return null

  return (
    <main style={s.main}>
      <div style={se.bar}>
        <button onClick={() => navigate('/photos-terrain')} style={se.backBtn} data-tour="retour-photos">← Retour</button>
        <div style={se.tools}>
          <span style={se.toolLabel}>Outil :</span>
          {(['pin', 'rect', 'polygon', 'pan'] as const).map((tool) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              style={{ ...se.toolBtn, ...(activeTool === tool ? se.toolBtnOn : {}) }}
            >
              {TOOL_LABELS[tool]}
            </button>
          ))}
        </div>
        <span style={se.photoName}>{photo.name ?? 'Photo'}</span>
      </div>

      <div style={se.layout}>
        <div style={se.canvasCol}>
          {/* data-guide : repère visé par le script de captures du guide */}
          <div style={se.canvas} data-guide="canvas">
            <PhotoCanvas
              imageUrl={photo.storageUrl}
              annotations={annotations}
              activeTool={activeTool}
              selectedId={expandedId}
              isPV={false}
              onAdd={addAnnotation}
              onMove={moveAnnotation}
              onSelect={setExpandedId}
            />
          </div>
          <p style={se.canvasHint}>
            Point : cliquer · Rectangle : cliquer-glisser · Polygone : cliquer chaque sommet puis refermer sur le premier (ou ↵) · Main : déplacer l'image
          </p>
        </div>
        <div style={se.list} data-tour="annotations">
          <p style={se.listTitle}>Annotations ({annotations.length})</p>
          {annotations.length === 0 && (
            <p style={se.listEmpty}>Sélectionnez un outil puis cliquez sur la photo.</p>
          )}
          {annotations.map((ann, i) => {
            const isExpanded = expandedId === ann.id
            return (
              <div key={ann.id} style={se.annItem}>
                <div style={{ ...se.annNum, ...(isExpanded ? se.annNumOn : {}), background: SEVERITY_COLORS[ann.severity] }}>{i + 1}</div>
                <div style={se.annFields}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                    style={{ ...se.annSummary, ...(isExpanded ? se.annSummaryOn : {}) }}
                  >
                    <span style={{ ...se.annSeverityDot, background: SEVERITY_COLORS[ann.severity] }} />
                    <span style={{ ...se.annSummaryText, ...(isExpanded ? { color: '#fff' } : {}) }}>
                      {ann.label || 'Sans description'}
                    </span>
                    <span style={{ ...se.annChevron, ...(isExpanded ? { color: 'rgba(255,255,255,0.7)' } : {}) }}>
                      {isExpanded ? '▾' : '▸'}
                    </span>
                  </button>
                  {isExpanded && (
                    <>
                      <div style={se.severityChips}>
                        {anomalyTypes.map((t) => (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => updateAnnotation(ann.id, { label: t.label, severity: t.severity })}
                            style={{ ...se.chip, ...(ann.label === t.label ? se.chipOn : {}) }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <input
                        ref={(el) => {
                          if (pendingLabelId === ann.id && el) { el.focus(); setPendingLabelId(null) }
                        }}
                        style={se.annInput}
                        value={ann.label}
                        onChange={(e) => updateAnnotation(ann.id, { label: e.target.value })}
                        placeholder="Décrire l'anomalie…"
                      />
                      <div style={se.severityChips}>
                        {(['faible', 'modere', 'grave', 'critique'] as const).map((lv: SeverityLevel) => (
                          <button
                            key={lv}
                            onClick={() => updateAnnotation(ann.id, { severity: lv })}
                            style={{
                              ...se.chip,
                              ...(ann.severity === lv
                                ? { background: SEVERITY_COLORS[lv], border: `1.5px solid ${SEVERITY_COLORS[lv]}`, color: '#fff' }
                                : {}),
                            }}
                          >
                            {SEVERITY_LABELS[lv]}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => deleteAnnotation(ann.id)} style={se.annDelete} aria-label="Supprimer">✕</button>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { padding: '48px 40px 48px', maxWidth: 1400, margin: '0 auto' },
}
const se: Record<string, React.CSSProperties> = {
  bar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1.5px solid #dde1e6' },
  backBtn: { background: 'none', border: '1.5px solid #dde1e6', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#5a7083', fontFamily: 'inherit', minHeight: 36 },
  tools: { display: 'flex', alignItems: 'center', gap: 6 },
  toolLabel: { fontSize: 13, color: '#5a7083', marginRight: 4 },
  toolBtn: { background: '#f3f4f6', border: '1.5px solid #dde1e6', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151', fontFamily: 'inherit', minHeight: 36 },
  toolBtnOn: { background: '#1a2e44', border: '1.5px solid #1a2e44', color: '#fff' },
  photoName: { marginLeft: 'auto', fontSize: 13, color: '#5a7083', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 },
  layout: { display: 'flex', gap: 16, alignItems: 'flex-start' },
  canvasCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  canvas: { borderRadius: 8, overflow: 'hidden', border: '1.5px solid #dde1e6' },
  canvasHint: { fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.5 },
  list: { width: 220, flexShrink: 0, border: '1.5px solid #dde1e6', borderRadius: 12, padding: 16, background: '#fff', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '80vh', overflowY: 'auto' },
  listTitle: { fontSize: 11, fontWeight: 700, color: '#5a7083', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 },
  listEmpty: { fontSize: 13, color: '#9ca3af', margin: 0 },
  annItem: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  annNum: { width: 24, height: 24, borderRadius: '50%', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  annNumOn: { background: '#1a2e44' },
  annFields: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  annSummary: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: 28, boxSizing: 'border-box' },
  annSummaryOn: { background: '#1a2e44' },
  annSeverityDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  annSummaryText: { flex: 1, minWidth: 0, fontSize: 13, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  annChevron: { fontSize: 11, color: '#9ca3af', flexShrink: 0 },
  annInput: { width: '100%', border: '1.5px solid #dde1e6', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  severityChips: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  chip: { padding: '4px 8px', borderRadius: 12, border: '1.5px solid #dde1e6', background: '#fff', cursor: 'pointer', fontSize: 11, minHeight: 28, fontFamily: 'inherit', color: '#374151' },
  chipOn: { background: '#1a2e44', border: '1.5px solid #1a2e44', color: '#fff', fontWeight: 700 },
  annDelete: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: 4, flexShrink: 0 },
}
