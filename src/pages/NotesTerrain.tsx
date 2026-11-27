/**
 * Mode terrain : prise de notes sur téléphone pendant le vol.
 *
 * Écran pensé pour une main : gros boutons, saisie courte. La dictée vocale
 * passe par le micro du clavier du téléphone (aucune dépendance).
 *
 * Chaque note enregistre l'heure (pour le rattachement aux photos) et, si
 * l'utilisateur l'autorise, la position GPS du téléphone.
 * Fonctionne sans réseau une fois la page chargée (service worker).
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CarnetTerrain, NoteTerrain, SeverityLevel } from '../types'
import { SEVERITY_LABELS, SEVERITY_COLORS } from '../lib/constants'
import {
  listCarnets, getCarnet, saveCarnet, createCarnet, deleteCarnet,
  lirePosition, exportCarnet,
} from '../lib/notesTerrain'
import AideEcran from '../components/AideEcran'
import { lancerVisite } from '../lib/visiteGuidee'

const GRAVITES: SeverityLevel[] = ['faible', 'modere', 'grave', 'critique']

export default function NotesTerrain() {
  const navigate = useNavigate()
  const [carnets, setCarnets] = useState<CarnetTerrain[]>(() => listCarnets())
  const [carnetId, setCarnetId] = useState<string | null>(null)
  const carnet = carnetId ? getCarnet(carnetId) : null

  /** Recharge la liste après une modification. */
  function refresh() { setCarnets(listCarnets()) }

  if (!carnet) {
    return (
      <ListeCarnets
        carnets={carnets}
        onOpen={(id) => setCarnetId(id)}
        onCreate={(titre) => { const c = createCarnet(titre); refresh(); setCarnetId(c.id) }}
        onDelete={(id) => { deleteCarnet(id); refresh() }}
        onBureau={() => navigate('/app')}
        onGuide={() => navigate('/guide')}
      />
    )
  }
  return <Carnet carnet={carnet} onBack={() => { setCarnetId(null); refresh() }} />
}

// ── Liste des carnets ─────────────────────────────────────────────────────────

function ListeCarnets({ carnets, onOpen, onCreate, onDelete, onBureau, onGuide }: {
  carnets: CarnetTerrain[]
  onOpen: (id: string) => void
  onCreate: (titre: string) => void
  onDelete: (id: string) => void
  onBureau: () => void
  onGuide: () => void
}) {
  const [titre, setTitre] = useState('')
  return (
    <main style={s.main}>
      <h1 style={s.title}>Notes terrain</h1>
      <p style={s.sub}>Un carnet par mission. Les notes restent sur ce téléphone jusqu'à l'export.</p>
      <AideEcran id="notes-terrain">
        Ouvrez cette page avant de partir : elle marche ensuite hors réseau. Une note par défaut vu à l'écran,
        puis « Exporter » le carnet en fin de vol pour l'envoyer vers l'ordinateur.
      </AideEcran>

      {/* Visite guidée de la prise de notes (driver.js) */}
      <button onClick={() => void lancerVisite(0, 'terrain')} style={s.visiteBtn}>
        🧪 Découvrir en 1 minute (visite guidée)
      </button>

      <form onSubmit={(e) => { e.preventDefault(); onCreate(titre); setTitre('') }} style={s.newRow} data-tour="terrain-nouveau">
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ex. Gymnase Saint-Pierre"
          style={s.input}
          aria-label="Nom de la mission"
        />
        <button type="submit" style={s.btnPrimary}>Nouveau</button>
      </form>

      <div style={s.list}>
        {carnets.map((c) => (
          <div key={c.id} style={s.card}>
            <button onClick={() => onOpen(c.id)} style={s.cardMain}>
              <span style={s.cardTitle}>{c.titre}</span>
              <span style={s.cardSub}>
                {new Date(c.creeLe).toLocaleDateString('fr-FR')} · {c.notes.length} note{c.notes.length > 1 ? 's' : ''}
              </span>
            </button>
            <button
              onClick={() => { if (confirm(`Supprimer le carnet « ${c.titre} » ?`)) onDelete(c.id) }}
              style={s.iconBtn}
              aria-label="Supprimer le carnet"
            >🗑</button>
          </div>
        ))}
        {carnets.length === 0 && <p style={s.empty}>Aucun carnet pour l'instant.</p>}
      </div>

      <button onClick={onBureau} style={{ ...s.link, marginTop: 32 }}>Aller aux rapports (ordinateur) →</button>
      <button onClick={onGuide} style={{ ...s.link, display: 'block' }}>Comment ça marche ? (guide)</button>
      {/* Logiciel libre AGPL-3.0 : lien vers le code source (article 13 de la licence) */}
      <a href="https://github.com/sit-pmo/dronereport" target="_blank" rel="noreferrer" style={s.source}>Logiciel libre (AGPL-3.0) · code source</a>
    </main>
  )
}

// ── Un carnet : saisie + liste des notes ──────────────────────────────────────

function Carnet({ carnet, onBack }: { carnet: CarnetTerrain; onBack: () => void }) {
  const [texte, setTexte] = useState('')
  const [gravite, setGravite] = useState<SeverityLevel | undefined>(undefined)
  const [notes, setNotes] = useState<NoteTerrain[]>(carnet.notes)
  const [enCours, setEnCours] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  /** Enregistre le carnet avec la nouvelle liste de notes. */
  function persist(next: NoteTerrain[]) {
    setNotes(next)
    saveCarnet({ ...carnet, notes: next })
  }

  async function ajouter() {
    if (!texte.trim() && !gravite) return
    // L'heure est figée au clic, avant l'attente du GPS
    const prisLe = new Date().toISOString()
    setEnCours(true)
    const id = crypto.randomUUID()
    // La note est enregistrée tout de suite, la position est ajoutée ensuite
    const note: NoteTerrain = { id, prisLe, texte: texte.trim(), gravite }
    const next = [note, ...notes]
    persist(next)
    setTexte('')
    setGravite(undefined)
    setEnCours(false)
    inputRef.current?.focus()
    const gps = await lirePosition()
    if (gps) {
      const latest = getCarnetNotes(carnet.id) ?? next
      persist(latest.map((n) => (n.id === id ? { ...n, gps } : n)))
    }
  }

  /** Marque l'instant sans texte : utile pour noter « quelque chose ici », à compléter au bureau. */
  function repere() {
    const note: NoteTerrain = { id: crypto.randomUUID(), prisLe: new Date().toISOString(), texte: '(repère à compléter)' }
    persist([note, ...notes])
  }

  function supprimer(id: string) {
    persist(notes.filter((n) => n.id !== id))
  }

  return (
    <main style={s.main}>
      <div style={s.topBar}>
        <button onClick={onBack} style={s.link}>← Carnets</button>
        <button onClick={() => exportCarnet({ ...carnet, notes })} style={s.btnSecondary} disabled={!notes.length} data-tour="terrain-exporter">
          Exporter
        </button>
      </div>
      <h1 style={s.title}>{carnet.titre}</h1>

      {/* Bloc de saisie : surligné en entier par la visite guidée (texte, gravité, boutons) */}
      <div data-tour="terrain-saisie">
        <textarea
          ref={inputRef}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Ex. tuiles déplacées côté nord, près de la cheminée (micro du clavier pour dicter)"
          rows={3}
          style={s.textarea}
          data-tour="terrain-texte"
        />

        <div style={s.graviteRow} role="radiogroup" aria-label="Gravité" data-tour="terrain-gravite">
          {GRAVITES.map((g) => (
            <button
              key={g}
              onClick={() => setGravite(gravite === g ? undefined : g)}
              role="radio"
              aria-checked={gravite === g}
              style={{
                ...s.chip,
                borderColor: SEVERITY_COLORS[g],
                background: gravite === g ? SEVERITY_COLORS[g] : '#fff',
                color: gravite === g ? '#fff' : '#0f1a25',
              }}
            >
              {SEVERITY_LABELS[g]}
            </button>
          ))}
        </div>

        <div style={s.actionRow}>
          <button onClick={ajouter} disabled={enCours || (!texte.trim() && !gravite)} style={{ ...s.btnPrimary, flex: 2 }} data-tour="terrain-ajouter">
            + Ajouter la note
          </button>
          <button onClick={repere} style={{ ...s.btnSecondary, flex: 1 }} title="Marque l'heure sans texte" data-tour="terrain-repere">
            ⏱ Repère
          </button>
        </div>
      </div>

      <div style={s.list}>
        {notes.map((n) => (
          <div key={n.id} style={s.noteCard} data-tour="terrain-note">
            <div style={s.noteHead}>
              <span style={s.noteTime}>{new Date(n.prisLe).toLocaleTimeString('fr-FR')}</span>
              {n.gravite && <span style={{ ...s.badge, background: SEVERITY_COLORS[n.gravite] }}>{SEVERITY_LABELS[n.gravite]}</span>}
              <span style={s.noteGps}>{n.gps ? `GPS ±${n.gps.precisionM ?? '?'} m` : 'sans GPS'}</span>
              <button onClick={() => supprimer(n.id)} style={s.iconBtn} aria-label="Supprimer la note">✕</button>
            </div>
            {n.texte && <p style={s.noteText}>{n.texte}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}

/** Relit les notes du carnet depuis le cache (évite d'écraser une note ajoutée pendant l'attente du GPS). */
function getCarnetNotes(id: string): NoteTerrain[] | undefined {
  return getCarnet(id)?.notes
}

// Mise en page mobile : cibles ≥ 44 px, une colonne
const s: Record<string, React.CSSProperties> = {
  main: { padding: '20px 16px 48px', maxWidth: 560, margin: '0 auto', fontFamily: 'inherit' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 700, margin: '8px 0 6px', fontFamily: "'Instrument Sans', sans-serif", color: '#0f1a25' },
  sub: { fontSize: 14, color: '#5a7083', margin: '0 0 18px', lineHeight: 1.5 },
  newRow: { display: 'flex', gap: 8, marginBottom: 20 },
  input: { flex: 1, fontSize: 16, padding: '12px 14px', border: '1.5px solid #d3dee7', borderRadius: 8, minHeight: 48, fontFamily: 'inherit' },
  textarea: { width: '100%', boxSizing: 'border-box', fontSize: 16, padding: 12, border: '1.5px solid #d3dee7', borderRadius: 8, fontFamily: 'inherit', resize: 'vertical', marginTop: 8 },
  graviteRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '10px 0' },
  chip: { border: '2px solid', borderRadius: 8, padding: '10px 4px', fontSize: 13.5, fontWeight: 600, minHeight: 44, cursor: 'pointer', fontFamily: 'inherit' },
  actionRow: { display: 'flex', gap: 8, marginBottom: 20 },
  btnPrimary: { background: '#0f1a25', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 16, fontWeight: 600, minHeight: 52, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecondary: { background: '#fff', color: '#0f1a25', border: '1.5px solid #c9d3dc', borderRadius: 8, padding: '10px 14px', fontSize: 15, fontWeight: 600, minHeight: 48, cursor: 'pointer', fontFamily: 'inherit' },
  source: { display: 'block', marginTop: 24, fontSize: 13, color: '#8a9eb0' },
  visiteBtn: {
    display: 'block', width: '100%', margin: '0 0 16px', padding: '12px 14px', borderRadius: 10,
    background: '#fef3e2', border: '1.5px solid #f3d9b1', color: '#1a2e44', fontSize: 15, fontWeight: 600,
    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
  },
  link: { background: 'none', border: 'none', color: '#c07828', fontSize: 15, fontWeight: 600, padding: '10px 0', cursor: 'pointer', fontFamily: 'inherit' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { display: 'flex', alignItems: 'center', border: '1.5px solid #e4ecf2', borderRadius: 10, background: '#fff' },
  cardMain: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, background: 'none', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minHeight: 56 },
  cardTitle: { fontSize: 16, fontWeight: 600, color: '#0f1a25' },
  cardSub: { fontSize: 13, color: '#8a9eb0' },
  iconBtn: { background: 'none', border: 'none', fontSize: 16, padding: 12, cursor: 'pointer', minWidth: 44, minHeight: 44, color: '#8a9eb0' },
  empty: { color: '#8a9eb0', fontSize: 14 },
  noteCard: { border: '1.5px solid #e4ecf2', borderRadius: 10, padding: '8px 4px 10px 12px', background: '#fff' },
  noteHead: { display: 'flex', alignItems: 'center', gap: 8 },
  noteTime: { fontSize: 14, fontWeight: 700, color: '#0f1a25', fontVariantNumeric: 'tabular-nums' },
  badge: { fontSize: 11.5, fontWeight: 700, color: '#fff', borderRadius: 4, padding: '2px 6px' },
  noteGps: { fontSize: 12, color: '#8a9eb0', marginLeft: 'auto' },
  noteText: { margin: '2px 8px 0 0', fontSize: 15, color: '#24384a', lineHeight: 1.45, whiteSpace: 'pre-wrap' },
}
