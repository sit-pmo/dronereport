import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PhotoItem } from '../types'
import { saveDraft, loadDraft, updateDraftPhotos } from '../lib/reportDraft'
import { useDraft } from '../hooks/useDraft'
import { storePhotoLocally } from '../lib/localPhoto'
import { readPhotoMeta } from '../lib/photoMeta'
import { downscaleImage } from '../lib/imageUtils'

const MAX_FILE_SIZE_MB = 30
const TERRAIN_MAX_WIDTH = 1200
const TERRAIN_MAX_BYTES = 200 * 1024

export default function PhotosTerrain() {
  const navigate = useNavigate()
  const { draft, setDraft } = useDraft()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])

  useEffect(() => {
    if (draft && !draft.ignPlanDataUrl) navigate('/situation')
  }, [draft]) // eslint-disable-line react-hooks/exhaustive-deps

  const photos = draft?.photos ?? []
  const hasDone = photos.some((p) => p.status === 'done')

  function savePhotos(updated: PhotoItem[]) {
    const d = draftRef.current
    if (!d) return
    const next = updateDraftPhotos(d, updated)
    saveDraft(next)
    setDraft(next)
  }

  function updatePhoto(id: string, patch: Partial<PhotoItem>) {
    // Lit depuis localStorage (pas draftRef) pour éviter la race condition avec Promise.all :
    // deux uploads concurrents écrasaient mutuellement leur état done via le ref périmé.
    const uuid = draftRef.current?.sessionUuid
    if (!uuid) return
    const d = loadDraft(uuid)
    if (!d) return
    const updated = (d.photos ?? []).map((p) => p.id === id ? { ...p, ...patch } : p)
    const next = updateDraftPhotos(d, updated)
    saveDraft(next)
    setDraft(next)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !draftRef.current) return

    const newPhotos: PhotoItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      status: 'uploading' as const,
      progress: 0,
    }))

    const d = draftRef.current
    const updated = [...(d.photos ?? []), ...newPhotos]
    savePhotos(updated)

    // Traitement 3 par 3 : une séance drone fait souvent 50 photos de 10 Mo,
    // tout traiter en parallèle saturerait la mémoire du navigateur.
    const queue = files.map((file, i) => () => uploadTerrainPhoto(newPhotos[i].id, file))
    const worker = async () => { while (queue.length) await queue.shift()!() }
    await Promise.all([worker(), worker(), worker()])
  }

  async function uploadTerrainPhoto(id: string, file: File) {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      updatePhoto(id, { status: 'failed', errorMsg: `Fichier trop lourd (max ${MAX_FILE_SIZE_MB} MB)` })
      return
    }
    try {
      // Métadonnées lues sur l'original : la réduction les efface
      const meta = await readPhotoMeta(file)
      updatePhoto(id, { progress: 10, meta })
      const blob = await downscaleImage(file, TERRAIN_MAX_WIDTH, TERRAIN_MAX_BYTES)
      if (!draftRef.current) return
      updatePhoto(id, { progress: 50 })
      // Stockage local : la photo reste dans le navigateur
      const publicUrl = await storePhotoLocally(blob)
      updatePhoto(id, { status: 'done', storageUrl: publicUrl, progress: undefined })
    } catch {
      updatePhoto(id, { status: 'failed', errorMsg: 'Erreur — réessayez', progress: undefined })
    }
  }

  function removePhoto(id: string) {
    const d = draftRef.current
    if (!d) return
    savePhotos((d.photos ?? []).filter((p) => p.id !== id))
  }

  async function retryPhoto(id: string) {
    // Trouve le fichier original — impossible sans le stocker; demander à re-sélectionner
    updatePhoto(id, { status: 'failed', errorMsg: 'Veuillez supprimer et ré-importer ce fichier' })
  }

  return (
    <main style={s.main}>
      <h1 style={s.title}>Photos terrain</h1>
      <p style={s.sub}>Importez les photos du drone (fichiers d'origine, pour garder l'heure et le GPS). Vous pourrez annoter les anomalies sur chacune et y rattacher vos notes terrain.</p>

      <button onClick={() => fileInputRef.current?.click()} style={s.addBtn}>
        + Ajouter des photos
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {photos.length > 0 && (
        <div style={s.list}>
          {[...photos].sort((a, b) => (a.meta?.prisLe ?? "~").localeCompare(b.meta?.prisLe ?? "~")).map((photo) => (
            <div key={photo.id} style={s.row}>
              <div style={s.thumb}>
                {photo.status === 'done' && photo.storageUrl
                  ? <img src={photo.storageUrl} alt="" style={s.thumbImg} />
                  : <div style={s.thumbPlaceholder}>
                      {photo.status === 'uploading' && <span style={s.spinner}>⟳</span>}
                      {photo.status === 'failed' && <span style={s.failIcon}>✕</span>}
                    </div>
                }
                {photo.status === 'uploading' && typeof photo.progress === 'number' && (
                  <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${photo.progress}%` }} /></div>
                )}
              </div>
              <div style={s.info}>
                {photo.status === 'failed'
                  ? <span style={s.errorText}>{photo.errorMsg}</span>
                  : <span style={s.name}>{photo.name ?? 'Photo'}</span>
                }
                {photo.meta?.prisLe && (
                  <span style={s.annCount}>Prise à {photo.meta.prisLe.slice(11, 19)}{photo.meta.altitudeRelativeM !== undefined ? ` · ${Math.round(photo.meta.altitudeRelativeM)} m` : ''}</span>
                )}
                {photo.status === 'done' && (
                  <span style={s.annCount}>
                    {(photo.annotations?.length ?? 0)} annotation{(photo.annotations?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={s.actions}>
                {photo.status === 'done' && (
                  <button onClick={() => navigate(`/annotate-terrain/${photo.id}`)} style={s.annotateBtn}>
                    ✏ Annoter
                  </button>
                )}
                {photo.status === 'failed' && (
                  <button onClick={() => retryPhoto(photo.id)} style={s.retryBtn}>Réessayer</button>
                )}
                <button onClick={() => removePhoto(photo.id)} style={s.removeBtn} aria-label="Supprimer">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasDone && (
        <button onClick={() => navigate('/rattacher-notes')} style={{ ...s.addBtn, background: '#fff', color: '#1a2e44', border: '1.5px solid #c9d3dc', marginTop: 24 }}>
          📝 Rattacher les notes terrain
        </button>
      )}

      <button
        onClick={() => navigate('/preview')}
        disabled={!hasDone}
        style={{ ...s.cta, ...(!hasDone ? s.ctaOff : {}), marginTop: 32 }}
      >
        Générer l'aperçu PDF →
      </button>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { padding: '48px 40px', maxWidth: 800, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 8, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.01em' },
  sub: { fontSize: 14, color: '#5a7083', marginBottom: 24, lineHeight: 1.5 },
  addBtn: { background: '#1a2e44', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minHeight: 44, marginBottom: 20 },
  list: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 14, padding: 14, border: '1.5px solid #dde1e6', borderRadius: 10, background: '#fff' },
  thumb: { position: 'relative', width: 80, height: 60, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#f3f4f6' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner: { fontSize: 20, color: '#9ca3af' },
  failIcon: { fontSize: 16, color: '#ef4444' },
  progressBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#e5e7eb' },
  progressFill: { height: '100%', background: '#1a2e44', transition: 'width 0.3s' },
  info: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  name: { fontSize: 14, fontWeight: 600, color: '#0f1a25', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  annCount: { fontSize: 12, color: '#5a7083' },
  errorText: { fontSize: 12, color: '#b91c1c' },
  actions: { display: 'flex', gap: 6, flexShrink: 0 },
  annotateBtn: { background: '#1a2e44', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', minHeight: 32 },
  retryBtn: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 7, color: '#b91c1c', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', minHeight: 32 },
  removeBtn: { background: 'none', border: '1.5px solid #dde1e6', borderRadius: 7, color: '#9ca3af', padding: '6px 10px', cursor: 'pointer', fontSize: 13, minHeight: 32, fontFamily: 'inherit' },
  cta: { width: '100%', background: '#1a2e44', color: '#fff', padding: '16px 24px', borderRadius: 10, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: 52, fontFamily: 'inherit' },
  ctaOff: { background: '#d1d5db', cursor: 'not-allowed' },
}
