/**
 * Rattachement des notes terrain aux photos du drone (sur PC).
 *
 * 1. On importe le carnet exporté depuis le téléphone (.json).
 * 2. L'outil propose, pour chaque note, la photo prise au plus près dans le temps.
 * 3. On corrige si besoin : décalage d'horloge global, ou choix manuel de la photo.
 * 4. On valide : chaque note devient une annotation (point au centre de la
 *    photo, texte + gravité), à placer ensuite précisément dans l'éditeur.
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CarnetTerrain, PhotoAnnotation } from '../types'
import { useDraft } from '../hooks/useDraft'
import { saveDraft, updateDraftPhotos } from '../lib/reportDraft'
import { parseCarnet, saveCarnet, getCarnet } from '../lib/notesTerrain'
import { proposerRattachements, estimerDecalage } from '../lib/rattachement'
import { SEVERITY_LABELS, SEVERITY_COLORS } from '../lib/constants'
import AideEcran from '../components/AideEcran'

export default function RattacherNotes() {
  const navigate = useNavigate()
  const { draft, setDraft } = useDraft()
  const [carnet, setCarnet] = useState<CarnetTerrain | null>(() =>
    draft?.carnetId ? getCarnet(draft.carnetId) : null,
  )
  const [erreur, setErreur] = useState<string | null>(null)
  const [decalageS, setDecalageS] = useState(0)
  const [toleranceMin, setToleranceMin] = useState(5)
  // Choix manuels : noteId → photoId ('' = ne pas rattacher)
  const [manuels, setManuels] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const photos = useMemo(
    () => (draft?.photos ?? []).filter((p) => p.status === 'done')
      .sort((a, b) => (a.meta?.prisLe ?? '~').localeCompare(b.meta?.prisLe ?? '~')),
    [draft?.photos],
  )
  const photosDatees = photos.filter((p) => p.meta?.prisLe).length

  const propositions = useMemo(
    () => (carnet ? proposerRattachements(carnet.notes, photos, decalageS, toleranceMin * 60) : []),
    [carnet, photos, decalageS, toleranceMin],
  )

  /** Photo retenue pour une note : choix manuel sinon proposition automatique. */
  function choix(noteId: string): string {
    if (noteId in manuels) return manuels[noteId]
    return propositions.find((p) => p.noteId === noteId)?.photoId ?? ''
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErreur(null)
    try {
      const c = parseCarnet(await file.text())
      saveCarnet(c) // garde une copie sur ce poste
      setCarnet(c)
      setManuels({})
      setDecalageS(0)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Fichier illisible')
    }
  }

  /** Crée les annotations. Une note déjà rattachée (même noteId) est mise à jour, pas dupliquée. */
  function valider() {
    if (!draft || !carnet) return
    const parPhoto = new Map<string, PhotoAnnotation[]>()
    for (const n of carnet.notes) {
      const photoId = choix(n.id)
      if (!photoId) continue
      const ann: PhotoAnnotation = {
        id: crypto.randomUUID(),
        noteId: n.id,
        type: 'pin',
        label: n.texte,
        severity: n.gravite ?? 'modere',
        // Au centre : l'utilisateur déplacera le point sur le défaut
        x: 0.5,
        y: 0.5,
      }
      parPhoto.set(photoId, [...(parPhoto.get(photoId) ?? []), ann])
    }
    const noteIds = new Set(carnet.notes.map((n) => n.id))
    const nextPhotos = (draft.photos ?? []).map((p) => {
      // Retire les annotations issues de ce carnet (rattachement précédent), garde les autres
      const conservees = (p.annotations ?? []).filter((a) => !a.noteId || !noteIds.has(a.noteId))
      const anciennes = new Map((p.annotations ?? []).filter((a) => a.noteId).map((a) => [a.noteId!, a]))
      const nouvelles = (parPhoto.get(p.id) ?? []).map((a) => {
        // Si la note était déjà placée sur cette photo, on garde sa position
        const old = anciennes.get(a.noteId!)
        return old ? { ...a, id: old.id, x: old.x, y: old.y, w: old.w, h: old.h, points: old.points, type: old.type } : a
      })
      return { ...p, annotations: [...conservees, ...nouvelles] }
    })
    const next = { ...updateDraftPhotos(draft, nextPhotos), carnetId: carnet.id }
    saveDraft(next)
    setDraft(next)
    navigate('/photos-terrain')
  }

  if (!draft) return null
  const nbRattachees = carnet ? carnet.notes.filter((n) => choix(n.id)).length : 0

  return (
    <main style={s.main}>
      <button onClick={() => navigate('/photos-terrain')} style={s.back}>← Photos</button>
      <h1 style={s.title}>Rattacher les notes terrain</h1>
      <p style={s.sub}>
        Chaque note est proposée sur la photo prise au plus près dans le temps.
        Vérifiez, corrigez si besoin, puis validez : les notes deviennent des points à placer sur les photos.
      </p>
      <AideEcran id="rattacher-notes">
        Si presque toutes les notes tombent sur la mauvaise photo, l'horloge du drone est décalée :
        réglez « Décalage horloge drone ». Après validation, ouvrez chaque photo pour poser le point sur le défaut.
      </AideEcran>

      {photosDatees < photos.length && (
        <p style={s.warn}>
          {photos.length - photosDatees} photo{photos.length - photosDatees > 1 ? 's' : ''} sans heure de prise de vue
          (fichier retouché ou envoyé par messagerie ?). Elles ne seront pas proposées automatiquement.
        </p>
      )}

      <div style={s.row}>
        <button onClick={() => fileRef.current?.click()} style={s.btnSecondary}>
          {carnet ? 'Changer de carnet' : 'Importer le carnet (.json)'}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
        {carnet && <span style={s.carnetName}>{carnet.titre} · {carnet.notes.length} notes</span>}
      </div>
      {erreur && <p style={s.error}>{erreur}</p>}

      {carnet && (
        <>
          <div style={s.reglages}>
            <label style={s.label}>
              Décalage horloge drone
              <span style={s.inline}>
                <input
                  type="number"
                  value={decalageS}
                  onChange={(e) => setDecalageS(Number(e.target.value) || 0)}
                  style={s.num}
                  step={10}
                /> s
              </span>
            </label>
            <button
              onClick={() => setDecalageS(estimerDecalage(carnet.notes, photos))}
              style={s.btnLink}
              title="Calcule l'écart médian entre les notes et les photos"
            >
              Estimer automatiquement
            </button>
            <label style={s.label}>
              Écart maximal
              <span style={s.inline}>
                <input
                  type="number"
                  value={toleranceMin}
                  min={1}
                  onChange={(e) => setToleranceMin(Math.max(1, Number(e.target.value) || 1))}
                  style={s.num}
                /> min
              </span>
            </label>
          </div>

          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Heure</th>
                <th style={s.th}>Note</th>
                <th style={s.th}>Photo</th>
                <th style={s.th}>Écart</th>
              </tr>
            </thead>
            <tbody>
              {[...carnet.notes].sort((a, b) => a.prisLe.localeCompare(b.prisLe)).map((n) => {
                const photoId = choix(n.id)
                const photo = photos.find((p) => p.id === photoId)
                const prop = propositions.find((p) => p.noteId === n.id)
                return (
                  <tr key={n.id}>
                    <td style={s.tdTime}>{new Date(n.prisLe).toLocaleTimeString('fr-FR')}</td>
                    <td style={s.td}>
                      {n.gravite && <span style={{ ...s.badge, background: SEVERITY_COLORS[n.gravite] }}>{SEVERITY_LABELS[n.gravite]}</span>}
                      {n.texte}
                    </td>
                    <td style={s.td}>
                      <div style={s.photoCell}>
                        {photo?.storageUrl && <img src={photo.storageUrl} alt="" style={s.thumb} />}
                        <select
                          value={photoId}
                          onChange={(e) => setManuels((m) => ({ ...m, [n.id]: e.target.value }))}
                          style={s.select}
                        >
                          <option value="">— Ne pas rattacher —</option>
                          {photos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.meta?.prisLe ? p.meta.prisLe.slice(11, 19) + ' · ' : ''}{p.name ?? 'Photo'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td style={s.tdTime}>
                      {n.id in manuels ? 'manuel' : prop?.ecartS !== undefined ? `${prop.ecartS} s` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <button onClick={valider} style={s.cta}>
            Valider ({nbRattachees} note{nbRattachees > 1 ? 's' : ''} rattachée{nbRattachees > 1 ? 's' : ''})
          </button>
        </>
      )}
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { padding: '40px 40px 64px', maxWidth: 1000, margin: '0 auto' },
  back: { background: 'none', border: 'none', color: '#5a7083', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 8, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.01em' },
  sub: { fontSize: 14, color: '#5a7083', marginBottom: 20, lineHeight: 1.5, maxWidth: 680 },
  warn: { fontSize: 13.5, color: '#8a5a12', background: '#fdf3e3', border: '1px solid #f0d9b0', borderRadius: 8, padding: '10px 12px' },
  row: { display: 'flex', alignItems: 'center', gap: 14, margin: '12px 0' },
  carnetName: { fontSize: 14, fontWeight: 600, color: '#0f1a25' },
  error: { color: '#b91c1c', fontSize: 13 },
  btnSecondary: { background: '#fff', color: '#1a2e44', border: '1.5px solid #c9d3dc', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' },
  btnLink: { background: 'none', border: 'none', color: '#c07828', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end', paddingBottom: 10, fontFamily: 'inherit' },
  reglages: { display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap', margin: '16px 0', padding: 14, background: '#f6f8fa', borderRadius: 10 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: '#5a7083' },
  inline: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#0f1a25' },
  num: { width: 90, padding: '8px 10px', fontSize: 14, border: '1.5px solid #d3dee7', borderRadius: 6, fontFamily: 'inherit' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 },
  th: { textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8a9eb0', padding: '8px 10px', borderBottom: '1.5px solid #e4ecf2' },
  td: { padding: '10px', borderBottom: '1px solid #eef2f5', verticalAlign: 'middle' },
  tdTime: { padding: '10px', borderBottom: '1px solid #eef2f5', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: '#24384a' },
  badge: { fontSize: 11, fontWeight: 700, color: '#fff', borderRadius: 4, padding: '2px 6px', marginRight: 8 },
  photoCell: { display: 'flex', alignItems: 'center', gap: 8 },
  thumb: { width: 64, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 },
  select: { padding: '8px', fontSize: 13.5, border: '1.5px solid #d3dee7', borderRadius: 6, maxWidth: 260, fontFamily: 'inherit' },
  cta: { marginTop: 24, background: '#0f1a25', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer', minHeight: 48, fontFamily: 'inherit' },
}
