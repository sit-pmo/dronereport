/**
 * Accueil de l'édition collectivité.
 *
 * - Liste des rapports stockés dans ce navigateur (IndexedDB).
 * - Création, reprise, suppression d'un rapport.
 * - Export / import d'un rapport complet en fichier .json (photos comprises),
 *   pour le reprendre sur un autre poste ou le passer à un collègue.
 * - Accès au mode terrain (prise de notes sur téléphone).
 *
 * Aucun compte, aucun paiement, aucun serveur.
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraft } from '../hooks/useDraft'
import {
  createPhotoDraft,
  saveDraft,
  deleteDraft,
  findExistingDrafts,
} from '../lib/reportDraft'
import { exportDraftFile, parseDraftFile } from '../lib/draftFile'
import { parseCarnet, saveCarnet } from '../lib/notesTerrain'
import { brouillonDepuisCarnet, meilleurPointGps, adresseProche } from '../lib/rapportDepuisCarnet'
import type { CarnetTerrain, ReportDraft } from '../types'

export default function Accueil() {
  const navigate = useNavigate()
  const { setDraft } = useDraft()
  // Liste locale, rafraîchie après chaque action
  const [drafts, setDrafts] = useState<ReportDraft[]>(() => findExistingDrafts())
  const [deleteTarget, setDeleteTarget] = useState<ReportDraft | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  // Carnet de notes terrain importé depuis l'accueil (proposé pour démarrer un rapport)
  const [carnetImporte, setCarnetImporte] = useState<CarnetTerrain | null>(null)
  const [creationEnCours, setCreationEnCours] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  /** Crée un nouveau rapport vierge et ouvre le formulaire mission. */
  function handleNew() {
    const d = createPhotoDraft()
    saveDraft(d)
    setDraft(d)
    navigate('/mission')
  }

  /** Reprend un rapport existant. */
  function handleOpen(d: ReportDraft) {
    setDraft(d)
    navigate('/mission')
  }

  /** Supprime définitivement un rapport de ce navigateur. */
  function handleConfirmDelete() {
    if (!deleteTarget) return
    deleteDraft(deleteTarget.sessionUuid)
    setDrafts(findExistingDrafts())
    setDeleteTarget(null)
  }

  /** Importe un rapport .json exporté depuis un autre poste. */
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    setCarnetImporte(null)
    const text = await file.text()
    try {
      const d = parseDraftFile(text)
      // Si le même rapport existe déjà ici, l'import l'écrase (version la plus récente reçue)
      saveDraft(d)
      setDrafts(findExistingDrafts())
    } catch (err) {
      // Ce n'est pas un rapport : c'est peut-être un carnet de notes terrain
      // exporté depuis le téléphone. On le garde sur ce poste et on
      // propose d'en faire un début de rapport, plutôt qu'un message d'erreur trompeur.
      try {
        const c = parseCarnet(text)
        saveCarnet(c)
        setCarnetImporte(c)
      } catch {
        setImportError(err instanceof Error ? err.message : 'Fichier illisible')
      }
    }
  }

  /**
   * Crée un rapport pré-rempli depuis le carnet importé (bâtiment, date,
   * adresse proche du GPS) et ouvre le formulaire mission pour compléter.
   */
  async function handleRapportDepuisCarnet() {
    if (!carnetImporte) return
    setCreationEnCours(true)
    const gps = meilleurPointGps(carnetImporte)
    // Adresse suggérée : vide si pas de GPS assez précis ou hors ligne
    const adresse = gps ? await adresseProche(gps.lat, gps.lon) : ''
    const d = brouillonDepuisCarnet(carnetImporte, adresse)
    saveDraft(d)
    setDraft(d)
    setCreationEnCours(false)
    navigate('/mission')
  }

  return (
    <main style={s.main}>
      <div style={s.hero}>
        <h1 style={s.title}>Rapports d'inspection drone</h1>
        <p style={s.subtitle}>
          Édition collectivité. Les données restent dans ce navigateur : rien n'est envoyé sur un serveur.
        </p>
      </div>

      <div style={s.actions}>
        <button onClick={handleNew} style={s.ctaPrimary}>+ Nouveau rapport</button>
        <button onClick={() => importRef.current?.click()} style={s.ctaSecondary}>Importer un rapport ou un carnet (.json)</button>
        <button onClick={() => navigate('/terrain')} style={s.ctaSecondary}>Notes terrain</button>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
      </div>
      {importError && <p style={s.error}>{importError}</p>}
      {carnetImporte && (
        <div style={s.info}>
          <p style={{ margin: 0 }}>
            Carnet de notes terrain « {carnetImporte.titre} » ({carnetImporte.notes.length} note
            {carnetImporte.notes.length > 1 ? 's' : ''}) enregistré sur ce poste.
          </p>
          <p style={{ margin: '6px 0 10px' }}>
            Vous pouvez démarrer un rapport pré-rempli (bâtiment, date, adresse proche du GPS à vérifier).
            Les notes se rattachent ensuite aux photos dans « Photos terrain ».
          </p>
          <button onClick={handleRapportDepuisCarnet} disabled={creationEnCours} style={s.ctaPrimary}>
            {creationEnCours ? 'Création…' : 'Créer un rapport à partir de ce carnet'}
          </button>
        </div>
      )}

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Rapports sur ce poste</h2>
        {drafts.length === 0 ? (
          <p style={s.empty}>Aucun rapport pour l'instant.</p>
        ) : (
          <div style={s.list}>
            {drafts.map((d) => (
              <div key={d.sessionUuid} style={s.card}>
                <div style={s.cardInfo}>
                  <span style={s.cardTitle}>{titreRapport(d)}</span>
                  <span style={s.cardDate}>Créé le {formatDate(d.createdAt)}</span>
                </div>
                <div style={s.cardActions}>
                  <button onClick={() => setDeleteTarget(d)} style={s.cardDelete} aria-label="Supprimer le rapport">🗑</button>
                  <button onClick={() => exportDraftFile(d)} style={s.cardCtaSecondary} title="Enregistrer le rapport dans un fichier">↓ .json</button>
                  <button onClick={() => handleOpen(d)} style={s.cardCta}>Ouvrir →</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={s.note}>
        Pensez à exporter vos rapports en .json : vider le cache du navigateur les efface.
      </p>

      {deleteTarget && (
        <div style={s.overlay} role="dialog" aria-modal="true">
          <div style={s.modal}>
            <p style={s.modalTitle}>Supprimer « {titreRapport(deleteTarget)} » ?</p>
            <p style={s.modalText}>Le rapport et ses photos seront effacés de ce navigateur.</p>
            <div style={s.modalActions}>
              <button onClick={() => setDeleteTarget(null)} style={s.ctaSecondary}>Annuler</button>
              <button onClick={handleConfirmDelete} style={s.ctaDanger}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/** Titre lisible : bâtiment · commune, sinon « Rapport sans titre ». */
function titreRapport(d: ReportDraft): string {
  const m = d.mission
  if (!m) return 'Rapport sans titre'
  const nom = m.batiment || m.clientNom
  return nom ? `${nom}${m.adresse ? ` · ${m.adresse}` : ''}` : 'Rapport sans titre'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Styles repris de la charte DESIGN.md (encre #0f1a25, ambre #c07828)
const s: Record<string, React.CSSProperties> = {
  main: { padding: '64px 40px 48px', maxWidth: 680, margin: '0 auto' },
  hero: { marginBottom: 32 },
  title: { fontSize: 30, fontWeight: 700, lineHeight: 1.15, marginBottom: 8, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.02em', color: '#0f1a25' },
  subtitle: { fontSize: 15, color: '#5a7083', lineHeight: 1.6, margin: 0 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  ctaPrimary: { background: '#0f1a25', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer', minHeight: 44 },
  ctaSecondary: { background: '#fff', color: '#0f1a25', border: '1.5px solid #d3dee7', borderRadius: 8, padding: '12px 18px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', minHeight: 44 },
  ctaDanger: { background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 18px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', minHeight: 44 },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 10 },
  info: { color: '#1a2e44', background: '#eef4f9', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 10 },
  section: { marginTop: 36 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#8a9eb0', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 },
  empty: { color: '#8a9eb0', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1.5px solid #e4ecf2', borderRadius: 10, padding: '14px 16px', gap: 12 },
  cardInfo: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  cardTitle: { fontSize: 14.5, fontWeight: 600, color: '#0f1a25', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardDate: { fontSize: 12.5, color: '#8a9eb0' },
  cardActions: { display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' },
  cardCta: { background: '#0f1a25', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', minHeight: 36 },
  cardCtaSecondary: { background: '#fff', color: '#0f1a25', border: '1.5px solid #d3dee7', borderRadius: 7, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 36 },
  cardDelete: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 8 },
  note: { marginTop: 28, fontSize: 12.5, color: '#8a9eb0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,26,37,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, width: '90%' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#0f1a25', margin: '0 0 8px' },
  modalText: { fontSize: 14, color: '#5a7083', margin: '0 0 20px' },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
}
