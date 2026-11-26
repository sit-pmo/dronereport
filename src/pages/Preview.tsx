import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PDFViewer, pdf } from '@react-pdf/renderer'
import { ReportPDF } from '../lib/pdfTemplate'
import { useDraft } from '../hooks/useDraft'
import { downscaleImage, blobToDataUrl } from '../lib/imageUtils'
import { exportDraftFile, slugify } from '../lib/draftFile'
import AideEcran from '../components/AideEcran'

export default function Preview() {
  const navigate = useNavigate()
  const { draft } = useDraft()

  const [photoDataUrls, setPhotoDataUrls] = useState<Map<string, string>>(new Map())
  const [loadingPhotos, setLoadingPhotos] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!draft) return

    const ortho = draft.ortho
    const isSansOrtho = !!draft.ignPlanDataUrl && !ortho
    if (!isSansOrtho && (!ortho || ortho.status !== 'done' || !ortho.storageUrl)) {
      setLoadingPhotos(false)
      return
    }

    async function fetchAndDownscale() {
      const d = draft!
      const map = new Map<string, string>()

      // Flow avec ortho (inchangé)
      if (ortho?.status === 'done' && ortho.storageUrl) {
        try {
          const res = await fetch(ortho.storageUrl)
          const blob = await res.blob()
          const small = await downscaleImage(new File([blob], 'ortho.jpg', { type: 'image/jpeg' }), 1200, 200 * 1024)
          map.set('cover', await blobToDataUrl(small))
        } catch {
          // Ortho indisponible — la section PDF affichera "Ortho indisponible"
        }

        await Promise.all(
          (ortho.annotations ?? [])
            .filter((a) => a.photoUrl)
            .map(async (a) => {
              try {
                const res = await fetch(a.photoUrl!)
                const blob = await res.blob()
                const small = await downscaleImage(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), 1200, 200 * 1024)
                map.set(`ann-${a.id}`, await blobToDataUrl(small))
              } catch {
                // Skip failed photo — won't appear in PDF
              }
            }),
        )
      }

      // Flow sans-ortho
      if (d.ignPlanDataUrl) {
        map.set('ign', d.ignPlanDataUrl)
      }

      await Promise.all(
        (d.photos ?? [])
          .filter((p) => p.status === 'done' && p.storageUrl)
          .map(async (p) => {
            try {
              const res = await fetch(p.storageUrl!)
              const blob = await res.blob()
              const small = await downscaleImage(new File([blob], 'terrain.jpg', { type: 'image/jpeg' }), 1200, 200 * 1024)
              map.set(`terrain-${p.id}`, await blobToDataUrl(small))
            } catch {
              // Skip failed photo — won't appear in PDF
            }
          }),
      )

      setPhotoDataUrls(map)
      setLoadingPhotos(false)
    }

    fetchAndDownscale()
  }, [draft?.sessionUuid])

  /** Génère le PDF dans le navigateur et le télécharge. Aucun envoi réseau. */
  async function handleDownload() {
    if (!draft) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const blob = await pdf(<ReportPDF draft={draft} photoDataUrls={photoDataUrls} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const nom = slugify(draft.mission?.batiment || draft.mission?.clientNom || 'rapport')
      a.download = `rapport-drone-${nom}-${draft.mission?.date ?? ''}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setDownloadError('Erreur lors de la génération. Vos données sont sauvegardées, réessayez.')
    } finally {
      setDownloading(false)
    }
  }

  if (!draft?.mission) {
    return (
      <main style={s.main}>
        <p>Aucun rapport en cours. <button onClick={() => navigate('/app')} style={s.link}>Retour à l'accueil</button></p>
      </main>
    )
  }

  const isReady = !loadingPhotos

  return (
    <main style={s.main}>
      <h1 style={s.title}>Aperçu du rapport</h1>
      <AideEcran id="apercu-pdf">
        Relisez le rapport, corrigez avec « Modifier », puis « Télécharger le PDF ».
        Pensez aussi à « Enregistrer le rapport (.json) » : sans lui, un nettoyage du navigateur efface le rapport.
      </AideEcran>

      {/* Quick-edit links */}
      <div style={s.editLinks}>
        <span style={s.editLabel}>Modifier :</span>
        <button onClick={() => navigate('/mission')} style={s.editBtn}>Infos mission</button>
        <button onClick={() => navigate('/photos')} style={s.editBtn}>Photos & annotations</button>
      </div>

      {loadingPhotos ? (
        <div style={s.loading}>
          <span style={s.spinner}>⟳</span>
          <span>Préparation des photos pour le PDF…</span>
        </div>
      ) : (
        <div style={s.pdfContainer}>
          <PDFViewer style={s.pdfViewer as any} showToolbar={false}>
            <ReportPDF draft={draft} photoDataUrls={photoDataUrls} />
          </PDFViewer>
        </div>
      )}

      {isReady && (
        <div style={s.actions}>
          <button onClick={handleDownload} disabled={downloading} style={s.cta}>
            {downloading ? 'Génération en cours…' : 'Télécharger le PDF →'}
          </button>
          <button onClick={() => exportDraftFile(draft)} style={s.ctaSubscribe}>
            Enregistrer le rapport (.json) pour le reprendre plus tard
          </button>
          {downloadError && <p style={s.errorText}>{downloadError}</p>}
        </div>
      )}
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { padding: '48px 40px 48px', maxWidth: 840, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 16, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.01em' },
  editLinks: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  editLabel: { fontSize: 13, color: '#5a7083' },
  editBtn: { background: 'none', border: '1px solid #dde1e6', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13, color: '#374151', minHeight: 32, fontFamily: 'inherit' },
  loading: { display: 'flex', alignItems: 'center', gap: 12, padding: 32, color: '#5a7083', fontSize: 15 },
  spinner: { fontSize: 24, display: 'inline-block' },
  pdfContainer: { border: '1.5px solid #dde1e6', borderRadius: 8, overflow: 'hidden', marginBottom: 24 },
  pdfViewer: { width: '100%', height: 620, border: 'none' },
  actions: { display: 'flex', flexDirection: 'column', gap: 12 },
  cta: { width: '100%', background: '#1a2e44', color: '#fff', padding: '16px 24px', borderRadius: 10, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: 52, fontFamily: 'inherit', textAlign: 'center' },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' },
  dividerText: { color: '#9aa5b1', fontSize: 13, flexShrink: 0 },
  ctaSubscribe: { width: '100%', background: 'transparent', color: '#c07828', padding: '14px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600, border: '1.5px solid #c07828', cursor: 'pointer', minHeight: 48, fontFamily: 'inherit', textAlign: 'center' },
  subscribeHint: { margin: 0, textAlign: 'center', fontSize: 12, color: '#9aa5b1' },
  errorText: { margin: 0, fontSize: 13, color: '#b91c1c', textAlign: 'center' },
  link: { background: 'none', border: 'none', color: '#1a2e44', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 'inherit' },
}
