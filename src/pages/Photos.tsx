import { useRef, useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PhotoItem } from '../types'
import { saveDraft, updateDraftOrtho, updateDraftConclusion, updateDraftMissionLimitations } from '../lib/reportDraft'
import { useDraft } from '../hooks/useDraft'
import { storePhotoLocally } from '../lib/localPhoto'
import { downscaleImage, extractGsd } from '../lib/imageUtils'
import { SEVERITY_COLORS, SEVERITY_LABELS, getDefaultMissionLimitations } from '../lib/constants'
import AideEcran from '../components/AideEcran'

const MAX_FILE_SIZE_MB = 400
const ORTHO_MAX_WIDTH = 4000
const ORTHO_MAX_BYTES = 8 * 1024 * 1024
const SEV_ORDER = ['critique', 'grave', 'modere', 'faible'] as const

export default function Photos() {
  const navigate = useNavigate()
  const { draft, setDraft } = useDraft()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const ortho = (draft?.ortho ?? null) as Omit<PhotoItem, '_file'> | null
  const isPV = draft?.mission?.typeInspection === 'photovoltaique'
  const orthoLocked = !!draft?.orthoLocked

  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])

  function saveOrtho(updated: Omit<PhotoItem, '_file'> | null) {
    const d = draftRef.current
    if (!d) return
    const next = updateDraftOrtho(d, updated)
    saveDraft(next)
    setDraft(next)
  }

  function updateOrtho(patch: Partial<PhotoItem>) {
    const current = draftRef.current?.ortho
    if (!current) return
    saveOrtho({ ...current, ...patch })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!draft) return
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return

    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      saveOrtho({ id: crypto.randomUUID(), status: 'failed', errorMsg: `Fichier trop lourd (max ${MAX_FILE_SIZE_MB} MB)` })
      return
    }

    const id = crypto.randomUUID()
    setFile(selected)
    saveOrtho({ id, name: selected.name, status: 'uploading', progress: 0 })
    uploadOrtho(id, selected)
  }

  async function uploadOrtho(_id: string, f: File) {
    if (!draftRef.current) return
    let blob: Blob
    let groundResolution: { x: number; y: number } | null = null
    updateOrtho({ progress: 10 })
    try {
      ;[blob, groundResolution] = await Promise.all([
        downscaleImage(f, ORTHO_MAX_WIDTH, ORTHO_MAX_BYTES),
        extractGsd(f),
      ])
    } catch (err) {
      updateOrtho({ status: 'failed', errorMsg: `Erreur de compression : ${err instanceof Error ? err.message : String(err)}` })
      return
    }
    updateOrtho({ progress: 50 })
    // Stockage local (IndexedDB via le brouillon) : la photo ne quitte pas le poste
    const publicUrl = await storePhotoLocally(blob)
    updateOrtho({
      status: 'done',
      storageUrl: publicUrl,
      progress: undefined,
      groundResolution: groundResolution ?? undefined,
    })
  }

  function retry() {
    if (!file || !ortho) return
    updateOrtho({ status: 'uploading', progress: 0, errorMsg: undefined })
    uploadOrtho(ortho.id, file)
  }

  function removeOrtho() {
    saveOrtho(null)
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetIgnPlan() {
    if (!draft) return
    const next = { ...draft, ignPlanDataUrl: undefined, photos: undefined }
    saveDraft(next as typeof draft)
    setDraft(next as typeof draft)
  }

  // ─── Stats & conclusion ────────────────────────────────────────────────────

  const annotations = ortho?.annotations ?? []
  const annotationsWithoutPhoto = !isPV ? annotations.filter((a) => !a.photoUrl) : []

  const sevCounts = useMemo(() => {
    const c = { faible: 0, modere: 0, grave: 0, critique: 0 }
    for (const a of annotations) {
      if (a.severity in c) c[a.severity as keyof typeof c]++
    }
    return c
  }, [annotations])

  const totalAnomalies = Object.values(sevCounts).reduce((s, v) => s + v, 0)

  const isUploading = ortho?.status === 'uploading'
  const isDone = ortho?.status === 'done'
  const isFailed = ortho?.status === 'failed'
  const canPreview = isDone || (!!draft?.ignPlanDataUrl && (draft?.photos ?? []).some((p) => p.status === 'done'))

  // Pré-remplit le texte par défaut une seule fois (n'écrase jamais une édition
  // ultérieure du pilote, même s'il vide le champ — on ne déclenche que sur "jamais initialisé")
  useEffect(() => {
    if (isDone && draft && typeof draft.missionLimitations === 'undefined') {
      const next = updateDraftMissionLimitations(draft, getDefaultMissionLimitations(draft.mission?.typeInspection))
      saveDraft(next)
      setDraft(next)
    }
  }, [isDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main style={s.main}>
      <h1 style={s.title}>{isPV ? 'Ortho thermique & anomalies' : 'Ortho & annotations'}</h1>
      <AideEcran id="photos">
        Avec une ortho, annotez les défauts directement dessus. Sans ortho, « Continuer sans ortho » mène
        au plan de situation puis aux « Photos terrain », où se rattachent aussi les notes prises au téléphone.
      </AideEcran>

      {/* Severity stats bar — read-only */}
      <div style={s.statsBar}>
        {SEV_ORDER.map((lv) => {
          const hasAny = sevCounts[lv] > 0
          return (
            <div key={lv} style={{ ...s.statBox, background: hasAny ? SEVERITY_COLORS[lv] : '#f3f4f6' }}>
              <span style={{ ...s.statCount, color: hasAny ? '#fff' : '#9ca3af' }}>{sevCounts[lv]}</span>
              <span style={{ ...s.statLabel, color: hasAny ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}>{SEVERITY_LABELS[lv]}</span>
            </div>
          )
        })}
        <div style={{ ...s.statBox, background: totalAnomalies > 0 ? '#1a2e44' : '#f3f4f6' }}>
          <span style={{ ...s.statCount, color: totalAnomalies > 0 ? '#fff' : '#9ca3af' }}>{totalAnomalies}</span>
          <span style={{ ...s.statLabel, color: totalAnomalies > 0 ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}>Total</span>
        </div>
      </div>

      {!ortho && !draft?.ignPlanDataUrl && (
        <div style={isPV ? s.dropzonePV : s.choiceGrid}>
          {isPV ? (
            <>
              <p style={s.dropzoneText}>Importez l'orthophoto thermique générée après votre mission.</p>
              <button onClick={() => fileInputRef.current?.click()} style={s.choiceBtnPrimary}>
                + Importer l'ortho thermique
              </button>
            </>
          ) : (
            <>
              <div style={s.choiceCardPrimary} data-tour="choix-ortho">
                <span style={s.choiceBadge}>★ Recommandé</span>
                <p style={s.choiceTitle}>Photo ortho ou nadir</p>
                <p style={s.choiceDesc}>
                  Méthode de référence. Une seule image couvre l'intégralité du bâtiment —
                  issue de votre logiciel de photogrammétrie (Pix4D, Metashape, WebODM) ou
                  d'une photo nadir manuelle. Annotations précises, rapport de qualité maximale
                  et suivi dans le temps possible.
                </p>
                <button onClick={() => fileInputRef.current?.click()} style={s.choiceBtnPrimary}>
                  + Importer l'ortho
                </button>
              </div>
              <div style={s.choiceCardSecondary}>
                <span style={s.choiceBadgeGrey}>Dernier recours</span>
                <p style={s.choiceTitle}>Pas d'ortho disponible</p>
                <p style={s.choiceDesc}>
                  Vol nadir impossible ce jour (contrainte réglementaire, bâtiment trop étroit,
                  météo…) ? Utilisez une carte IGN comme plan de situation et annotez
                  vos anomalies sur vos photos terrain individuelles.{' '}
                  <strong>Qualité réduite — privilégiez l'ortho si possible.</strong>
                </p>
                <button onClick={() => navigate('/situation')} style={s.choiceBtnSecondary} data-tour="sans-ortho">
                  Continuer sans ortho →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {ortho && (
        <div style={s.orthoRow}>
          <div style={s.orthoThumb}>
            {isDone && ortho.storageUrl
              ? <img src={ortho.storageUrl} alt="" style={s.orthoImg} />
              : <div style={s.orthoThumbPlaceholder}>
                  {isUploading && <span style={s.spinner}>⟳</span>}
                  {isFailed && <span style={s.failIcon}>✕</span>}
                </div>
            }
            {isUploading && typeof ortho.progress === 'number' && (
              <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${ortho.progress}%` }} /></div>
            )}
          </div>
          <div style={s.orthoInfo}>
            {isFailed
              ? <span style={s.errorText} role="alert">{ortho.errorMsg}</span>
              : <span style={s.orthoName}>{ortho.name ?? 'Ortho'}</span>}
            {isDone && (
              <span style={s.annCount}>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
            )}
            {orthoLocked && (
              <span style={s.lockedNote}>🔒 Ortho verrouillée — rapport déjà payé</span>
            )}
          </div>
          <div style={s.orthoActions}>
            {isFailed && (
              <button
                onClick={() => file ? retry() : fileInputRef.current?.click()}
                style={s.retryBtn}
              >
                Réessayer
              </button>
            )}
            {isDone && (
              <button onClick={() => navigate('/annotate')} style={s.annotateBtn}>✏ Annoter</button>
            )}
            {!orthoLocked && (
              <>
                <button onClick={() => fileInputRef.current?.click()} style={s.replaceBtn}>Remplacer</button>
                <button onClick={removeOrtho} style={s.removeBtn} aria-label="Supprimer">✕</button>
              </>
            )}
          </div>
        </div>
      )}

      {draft?.ignPlanDataUrl && (
        <div style={s.ignPreviewBlock}>
          <img src={draft.ignPlanDataUrl} alt="Plan de situation IGN" style={s.ignPreviewImg} />
          <div style={s.ignPreviewInfo}>
            <span style={s.ignPreviewLabel}>Plan de situation IGN</span>
            <div style={s.ignPreviewActions}>
              <button onClick={() => navigate('/situation')} style={s.replaceBtn}>Refaire la carte</button>
              <button onClick={() => navigate('/photos-terrain')} style={s.annotateBtn}>
                Photos terrain ({draft.photos?.length ?? 0})
              </button>
            </div>
            <button onClick={resetIgnPlan} style={s.switchToOrthoBtn}>
              ← J'ai finalement une ortho — revenir à l'import
            </button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Conclusion — visible once annotations exist */}
      {annotations.length > 0 && (
        <div style={s.conclusionSection}>
          <div style={s.conclusionHeader}>
            <span style={s.conclusionTitle}>Conclusion</span>
          </div>
          <textarea
            style={s.conclusionArea}
            value={draft?.conclusion ?? ''}
            onChange={(e) => {
              if (!draft) return
              const next = updateDraftConclusion(draft, e.target.value)
              saveDraft(next)
              setDraft(next)
            }}
            placeholder="Rédigez votre conclusion…"
            rows={4}
          />
        </div>
      )}

      {/* Limites de la mission — texte par défaut éditable, affiché en dernière page du PDF */}
      {isDone && (
        <div style={s.conclusionSection}>
          <div style={s.conclusionHeader}>
            <span style={s.conclusionTitle}>Limites de la mission</span>
          </div>
          <p style={s.limitationsHint}>
            Texte par défaut — relisez-le et adaptez-le à votre mission avant de générer le rapport.
          </p>
          <textarea
            style={s.conclusionArea}
            value={draft?.missionLimitations ?? getDefaultMissionLimitations(draft?.mission?.typeInspection)}
            onChange={(e) => {
              if (!draft) return
              const next = updateDraftMissionLimitations(draft, e.target.value)
              saveDraft(next)
              setDraft(next)
            }}
            rows={8}
          />
        </div>
      )}

      {isUploading && <p style={s.warning} role="status" aria-live="polite">Upload en cours — attendez la fin avant de générer l'aperçu.</p>}

      {annotationsWithoutPhoto.length > 0 && (
        <p style={s.warning} role="status">
          {annotationsWithoutPhoto.length} annotation{annotationsWithoutPhoto.length > 1 ? 's' : ''} sans photo jointe — le rapport sera généré sans image pour {annotationsWithoutPhoto.length > 1 ? 'celles-ci' : 'celle-ci'}.
        </p>
      )}

      <button
        onClick={() => navigate('/preview')}
        disabled={!canPreview}
        style={{ ...s.cta, ...(!canPreview ? s.ctaOff : {}) }}
      >
        {isUploading ? 'Upload en cours…' : "Générer l'aperçu PDF →"}
      </button>
    </main>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  main: { padding: '48px 40px 48px', maxWidth: 800, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 20, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.01em' },
  statsBar: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 },
  statBox: { borderRadius: 8, padding: '10px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 3 },
  statCount: { fontSize: 20, fontWeight: 700, lineHeight: '1' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  dropzonePV: { border: '2px dashed #dde1e6', borderRadius: 12, padding: '40px 24px', textAlign: 'center', marginBottom: 20, background: '#fafafa' },
  dropzoneText: { fontSize: 14, color: '#5a7083', marginBottom: 16, maxWidth: 440, margin: '0 auto 16px', lineHeight: 1.5 },
  choiceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  choiceCardPrimary: { border: '2px solid #1a2e44', borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc' },
  choiceCardSecondary: { border: '1.5px solid #dde1e6', borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa' },
  choiceBadge: { fontSize: 11, fontWeight: 700, color: '#c07828', background: '#fef3e2', borderRadius: 4, padding: '2px 8px', alignSelf: 'flex-start' as const },
  choiceBadgeGrey: { fontSize: 11, fontWeight: 600, color: '#9ca3af', background: '#f3f4f6', borderRadius: 4, padding: '2px 8px', alignSelf: 'flex-start' as const },
  choiceTitle: { fontSize: 16, fontWeight: 700, color: '#0f1a25', margin: 0 },
  choiceDesc: { fontSize: 13, color: '#5a7083', lineHeight: 1.55, margin: 0, flex: 1 },
  choiceBtnPrimary: { background: '#1a2e44', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minHeight: 44, marginTop: 4 },
  choiceBtnSecondary: { background: 'none', border: '1.5px solid #dde1e6', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', fontSize: 14, color: '#5a7083', fontFamily: 'inherit', minHeight: 44, marginTop: 4 },
  orthoRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: '14px', border: '1.5px solid #dde1e6', borderRadius: 10, background: '#fff', marginBottom: 20 },
  orthoThumb: { position: 'relative', width: 96, height: 72, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#f3f4f6' },
  orthoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  orthoThumbPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  progressBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#e5e7eb' },
  progressFill: { height: '100%', background: '#1a2e44', transition: 'width 0.3s' },
  spinner: { fontSize: 22, color: '#9ca3af' },
  failIcon: { fontSize: 18, color: '#ef4444' },
  orthoInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  orthoName: { fontSize: 14, fontWeight: 600, color: '#0f1a25' },
  annCount: { fontSize: 12, color: '#5a7083' },
  lockedNote: { fontSize: 12, color: '#9ca3af' },
  errorText: { fontSize: 12, color: '#b91c1c' },
  orthoActions: { display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' },
  annotateBtn: { background: '#1a2e44', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', minHeight: 32 },
  replaceBtn: { background: 'none', border: '1.5px solid #dde1e6', borderRadius: 7, color: '#5a7083', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', minHeight: 32 },
  retryBtn: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 7, color: '#b91c1c', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', minHeight: 32 },
  removeBtn: { background: 'none', border: '1.5px solid #dde1e6', borderRadius: 7, color: '#9ca3af', padding: '6px 10px', cursor: 'pointer', fontSize: 13, minHeight: 32, fontFamily: 'inherit' },
  conclusionSection: { border: '1.5px solid #dde1e6', borderRadius: 10, padding: 16, marginBottom: 20 },
  conclusionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  conclusionTitle: { fontSize: 15, fontWeight: 600, color: '#0f1a25' },
  conclusionArea: { width: '100%', border: '1.5px solid #dde1e6', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, color: '#0f1a25' },
  limitationsHint: { fontSize: 12, color: '#9ca3af', margin: '0 0 10px' },
  warning: { background: '#fef3e2', border: '1px solid #e5b87a', borderRadius: 8, padding: '10px 14px', color: '#92570a', fontSize: 14, marginBottom: 16 },
  cta: { width: '100%', background: '#1a2e44', color: '#fff', padding: '16px 24px', borderRadius: 10, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: 52, fontFamily: 'inherit' },
  ctaOff: { background: '#d1d5db', cursor: 'not-allowed' },
  switchToOrthoBtn: { background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontSize: 12, color: '#9ca3af', fontFamily: 'inherit', textDecoration: 'underline', textAlign: 'left' as const },
  ignPreviewBlock: { display: 'flex', gap: 14, padding: 14, border: '1.5px solid #dde1e6', borderRadius: 10, background: '#fff', marginBottom: 20, alignItems: 'center' },
  ignPreviewImg: { width: 120, height: 90, objectFit: 'cover', borderRadius: 6, flexShrink: 0 },
  ignPreviewInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  ignPreviewLabel: { fontSize: 14, fontWeight: 600, color: '#0f1a25' },
  ignPreviewActions: { display: 'flex', gap: 8 },
}
