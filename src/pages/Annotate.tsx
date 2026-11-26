import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PhotoAnnotation, Measure, SeverityLevel } from '../types'
import { saveDraft, updateDraftOrtho } from '../lib/reportDraft'
import { SEVERITY_LABELS, SEVERITY_COLORS, PV_ANOMALY_TYPES, PV_CUSTOM_COLOR, getRoofAnomalyTypes } from '../lib/constants'
import { useDraft } from '../hooks/useDraft'
import { storePhotoLocally } from '../lib/localPhoto'
import { downscaleImage } from '../lib/imageUtils'
import { formatDist, formatArea } from '../lib/measureFormat'
import PhotoCanvas from '../components/PhotoCanvas'

const MAX_FILE_SIZE_MB = 30

const TOOL_LABELS = {
  pin: '📍 Point',
  rect: '🔲 Rectangle',
  polygon: '🔺 Polygone',
  pan: '✋ Main',
  'measure-line': '📏 Ligne',
  'measure-polygon': '⬡ Surface',
} as const

export default function Annotate() {
  const navigate = useNavigate()
  const { draft, setDraft } = useDraft()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [activeTool, setActiveTool] = useState<'pin' | 'rect' | 'polygon' | 'pan' | 'measure-line' | 'measure-polygon'>('pin')
  const [pendingLabelId, setPendingLabelId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [uploadingPhotoForAnnId, setUploadingPhotoForAnnId] = useState<string | null>(null)

  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])

  const ortho = draft?.ortho ?? null
  const isPV = draft?.mission?.typeInspection === 'photovoltaique'
  const annotations = ortho?.annotations ?? []
  const anomalyTypes = isPV ? PV_ANOMALY_TYPES : getRoofAnomalyTypes(draft?.mission?.materiauToiture)

  useEffect(() => {
    if (draft && !draft.ortho?.storageUrl) navigate('/photos')
  }, [draft]) // eslint-disable-line react-hooks/exhaustive-deps

  function saveAnnotations(updated: PhotoAnnotation[]) {
    const d = draftRef.current
    if (!d || !d.ortho) return
    const next = updateDraftOrtho(d, { ...d.ortho, annotations: updated })
    saveDraft(next)
    setDraft(next)
  }

  function addAnnotation(ann: Omit<PhotoAnnotation, 'id' | 'label'>) {
    const d = draftRef.current
    if (!d?.ortho) return
    const newAnn: PhotoAnnotation = { ...ann, id: crypto.randomUUID(), label: '' }
    saveAnnotations([...(d.ortho.annotations ?? []), newAnn])
    setPendingLabelId(newAnn.id)
    setExpandedId(newAnn.id)
  }

  function updateAnnotation(id: string, patch: Partial<PhotoAnnotation>) {
    const d = draftRef.current
    if (!d?.ortho) return
    saveAnnotations((d.ortho.annotations ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  function moveAnnotation(id: string, x: number, y: number) {
    const d = draftRef.current
    if (!d?.ortho) return
    saveAnnotations(
      (d.ortho.annotations ?? []).map((a) => {
        if (a.id !== id) return a
        if (a.type === 'polygon' && a.points) {
          const dxShift = x - a.x
          const dyShift = y - a.y
          return { ...a, x, y, points: a.points.map((p) => ({ x: p.x + dxShift, y: p.y + dyShift })) }
        }
        return { ...a, x, y }
      }),
    )
  }

  function deleteAnnotation(id: string) {
    const d = draftRef.current
    if (!d?.ortho) return
    saveAnnotations((d.ortho.annotations ?? []).filter((a) => a.id !== id))
  }

  function addMeasure(m: Measure) {
    const d = draftRef.current
    if (!d?.ortho) return
    const next = updateDraftOrtho(d, { ...d.ortho, measurements: [...(d.ortho.measurements ?? []), m] })
    saveDraft(next)
    setDraft(next)
  }

  function deleteMeasure(id: string) {
    const d = draftRef.current
    if (!d?.ortho) return
    const next = updateDraftOrtho(d, { ...d.ortho, measurements: (d.ortho.measurements ?? []).filter((m) => m.id !== id) })
    saveDraft(next)
    setDraft(next)
  }

  // ─── Photo per annotation (Toiture only) ───────────────────────────────────

  function startPhotoUpload(annId: string) {
    setUploadingPhotoForAnnId(annId)
    photoInputRef.current?.click()
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const annId = uploadingPhotoForAnnId
    setUploadingPhotoForAnnId(null)
    if (!file || !annId || !draftRef.current) return

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return

    try {
      const blob = await downscaleImage(file, 1200, 200 * 1024)
      // Gros plan stocké localement dans le brouillon
      const publicUrl = await storePhotoLocally(blob)
      updateAnnotation(annId, { photoUrl: publicUrl })
    } catch {
      // Échec silencieux — l'annotation reste valide sans photo jointe
    }
  }

  function removeAnnotationPhoto(annId: string) {
    updateAnnotation(annId, { photoUrl: undefined })
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!ortho?.storageUrl) return null // redirect handled by the effect above

  return (
    <main style={s.main}>
      <div style={se.bar}>
        <button onClick={() => navigate('/photos')} style={se.backBtn}>
          ← Retour
        </button>
        <div style={se.tools}>
          <span style={se.toolLabel}>Annotation :</span>
          {(['pin', 'rect', 'polygon', 'pan'] as const).map((tool) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              style={{ ...se.toolBtn, ...(activeTool === tool ? se.toolBtnOn : {}) }}
            >
              {TOOL_LABELS[tool]}
            </button>
          ))}
          <div style={se.toolSep} />
          <span style={se.toolLabel}>Mesure :</span>
          <button
            onClick={() => setActiveTool('measure-line')}
            disabled={!ortho?.groundResolution}
            title={ortho?.groundResolution ? undefined : 'Chargez un GeoTIFF géoréférencé pour activer les mesures'}
            style={{ ...se.toolBtn, ...(activeTool === 'measure-line' ? se.toolBtnOn : {}), ...(ortho?.groundResolution ? {} : { opacity: 0.4, cursor: 'not-allowed' }) }}
          >
            {TOOL_LABELS['measure-line']}
          </button>
          <button
            onClick={() => setActiveTool('measure-polygon')}
            disabled={!ortho?.groundResolution}
            title={ortho?.groundResolution ? undefined : 'Chargez un GeoTIFF géoréférencé pour activer les mesures'}
            style={{ ...se.toolBtn, ...(activeTool === 'measure-polygon' ? se.toolBtnOn : {}), ...(ortho?.groundResolution ? {} : { opacity: 0.4, cursor: 'not-allowed' }) }}
          >
            {TOOL_LABELS['measure-polygon']}
          </button>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <div style={se.layout}>
        <div style={se.canvasCol}>
          <div style={se.canvas}>
            <PhotoCanvas
              imageUrl={ortho.storageUrl}
              annotations={annotations}
              activeTool={activeTool}
              selectedId={expandedId}
              isPV={isPV}
              onAdd={addAnnotation}
              onMove={moveAnnotation}
              onSelect={setExpandedId}
              measurements={ortho.measurements}
              onMeasure={addMeasure}
              onMeasureDelete={deleteMeasure}
              groundResolution={ortho.groundResolution}
            />
          </div>
          {(ortho.measurements ?? []).length > 0 && (
            <div style={{ marginTop: 12, border: '1.5px solid #dde1e6', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2e44', marginBottom: 8 }}>📏 Mesures</div>
              {(ortho.measurements ?? []).map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#1a2e44', padding: '4px 0', borderTop: i === 0 ? '1px solid #f0f2f5' : '1px solid #f0f2f5' }}>
                  <span>
                    {m.kind === 'line' ? '📏' : '⬡'}&nbsp;&nbsp;
                    {m.kind === 'line'
                      ? formatDist(m.distanceM)
                      : `${m.segmentsM.length} seg · ${formatArea(m.areaM2)}`}
                  </span>
                  <button
                    onClick={() => deleteMeasure(m.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
                    title="Supprimer cette mesure"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <p style={se.canvasHint}>
            Point : cliquer · Rectangle : cliquer-glisser · Polygone : cliquer chaque sommet puis refermer sur le premier (ou ↵, Échap annule) · Main : cliquer-glisser pour déplacer l'image, cliquer une annotation pour l'éditer · Glisser une forme existante pour la déplacer · Zoom : Espace + molette ou +/− · Défiler pour se déplacer dans l'image
          </p>
        </div>
        <div style={se.list}>
          <p style={se.listTitle}>Annotations ({annotations.length})</p>
          {annotations.length === 0 && (
            <p style={se.listEmpty}>Sélectionnez un outil puis cliquez sur l'ortho.</p>
          )}
          {annotations.map((ann, i) => {
            const isExpanded = expandedId === ann.id
            return (
            <div key={ann.id} style={se.annItem}>
              <div style={{ ...se.annNum, ...(isExpanded ? se.annNumOn : {}) }}>{i + 1}</div>
              <div style={se.annFields}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                  style={{ ...se.annSummary, ...(isExpanded ? se.annSummaryOn : {}) }}
                >
                  <span style={{ ...se.annSeverityDot, background: isPV ? (PV_ANOMALY_TYPES.find((t) => t.label === ann.label)?.color ?? (ann.label ? PV_CUSTOM_COLOR : '#9ca3af')) : SEVERITY_COLORS[ann.severity] }} />
                  <span style={{ ...se.annSummaryText, ...(isExpanded ? { color: '#fff' } : {}) }}>{ann.label || 'Sans description'}</span>
                  <span style={{ ...se.annChevron, ...(isExpanded ? { color: 'rgba(255,255,255,0.7)' } : {}) }}>{isExpanded ? '▾' : '▸'}</span>
                </button>
                {isExpanded && <>
                <div style={se.severityChips}>
                  {anomalyTypes.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => updateAnnotation(ann.id, { label: t.label, severity: t.severity })}
                      style={{
                        ...se.chip,
                        ...(ann.label === t.label ? se.chipOn : {}),
                      }}
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
                {/* Sévérité non affichée pour le PV : figuré + couleur fixes par type
                    identifient l'anomalie sans ambiguïté, pas besoin d'un 3e axe. */}
                {!isPV && (
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
                )}
                {!isPV && (
                  ann.photoUrl ? (
                    <div style={se.annPhotoRow}>
                      <img src={ann.photoUrl} alt="" style={se.annPhotoThumb} />
                      <button onClick={() => removeAnnotationPhoto(ann.id)} style={se.annPhotoRemove}>Retirer la photo</button>
                    </div>
                  ) : (
                    <button onClick={() => startPhotoUpload(ann.id)} style={se.annPhotoAdd}>+ Photo</button>
                  )
                )}
                </>}
              </div>
              <button onClick={() => deleteAnnotation(ann.id)} style={se.annDelete} aria-label="Supprimer">✕</button>
            </div>
            )
          })}
        </div>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoChange}
      />
    </main>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  main: { padding: '48px 40px 48px', maxWidth: 1400, margin: '0 auto' },
}

const se: Record<string, React.CSSProperties> = {
  bar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1.5px solid #dde1e6' },
  backBtn: { background: 'none', border: '1.5px solid #dde1e6', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#5a7083', fontFamily: 'inherit', minHeight: 36 },
  tools: { display: 'flex', alignItems: 'center', gap: 6 },
  toolLabel: { fontSize: 13, color: '#5a7083', marginRight: 4 },
  toolSep: { width: 1, height: 24, background: '#dde1e6', marginLeft: 6, marginRight: 6, flexShrink: 0 },
  toolBtn: { background: '#f3f4f6', border: '1.5px solid #dde1e6', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151', fontFamily: 'inherit', minHeight: 36 },
  toolBtnOn: { background: '#1a2e44', border: '1.5px solid #1a2e44', color: '#fff' },
  layout: { display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 },
  canvasCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  canvas: { borderRadius: 8, overflow: 'clip', border: '1.5px solid #dde1e6' },
  canvasHint: { fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.5 },
  list: { width: 220, flexShrink: 0, border: '1.5px solid #dde1e6', borderRadius: 12, padding: 16, background: '#fff', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '80vh', overflowY: 'auto' },
  listTitle: { fontSize: 11, fontWeight: 700, color: '#5a7083', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 },
  listEmpty: { fontSize: 13, color: '#9ca3af', margin: 0 },
  annItem: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  annNum: { width: 24, height: 24, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
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
  annPhotoAdd: { alignSelf: 'flex-start', background: 'none', border: '1.5px dashed #dde1e6', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#5a7083', fontFamily: 'inherit', minHeight: 28 },
  annPhotoRow: { display: 'flex', alignItems: 'center', gap: 8 },
  annPhotoThumb: { width: 36, height: 28, objectFit: 'cover', borderRadius: 4 },
  annPhotoRemove: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  annDelete: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: 4, minHeight: 'unset', flexShrink: 0 },
}
