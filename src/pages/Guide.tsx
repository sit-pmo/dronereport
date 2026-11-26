/**
 * Page « Guide » : le parcours complet pour quelqu'un qui découvre l'outil.
 *
 * Lisible sur ordinateur et sur téléphone. Sur téléphone, on n'affiche que
 * les étapes faites au téléphone (les autres se font au bureau), avec un
 * lien pour tout voir.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ETAPES_GUIDE, REGLES_GUIDE } from '../lib/guide'
import { reafficherAides } from '../lib/aidesVues'
import { useIsMobile } from '../hooks/useIsMobile'

export default function Guide() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  // Sur téléphone : étapes téléphone seulement, sauf si on demande tout
  const [toutVoir, setToutVoir] = useState(false)
  const [aidesReaffichees, setAidesReaffichees] = useState(false)

  const etapes = isMobile && !toutVoir
    ? ETAPES_GUIDE.filter((e) => e.appareil === 'Téléphone')
    : ETAPES_GUIDE

  return (
    <main style={s.main}>
      <button onClick={() => navigate(isMobile ? '/terrain' : '/app')} style={s.back}>
        ← {isMobile ? 'Notes terrain' : 'Accueil'}
      </button>
      <h1 style={s.title}>Guide</h1>
      <p style={s.sub}>
        Un rapport d'inspection en 5 étapes : les notes se prennent au téléphone pendant le vol,
        le rapport se fait ensuite sur ordinateur.
      </p>

      <ol style={s.list}>
        {etapes.map((e) => (
          <li key={e.n} style={s.card}>
            <div style={s.cardHead}>
              <span style={s.num}>{e.n}</span>
              <h2 style={s.cardTitle}>{e.titre}</h2>
              <span style={s.device}>{e.appareil === 'Téléphone' ? '📱' : '💻'} {e.appareil}</span>
            </div>
            <ul style={s.steps}>
              {e.faire.map((f) => <li key={f} style={s.step}>{f}</li>)}
            </ul>
            <p style={s.piege}><strong>À éviter :</strong> {e.piege}</p>
          </li>
        ))}
      </ol>

      {isMobile && !toutVoir && (
        <button onClick={() => setToutVoir(true)} style={s.linkBtn}>
          Voir aussi les étapes sur ordinateur (3 à 5)
        </button>
      )}

      <section style={s.rules}>
        <h2 style={s.rulesTitle}>À savoir</h2>
        <ul style={s.steps}>
          {REGLES_GUIDE.map((r) => <li key={r} style={s.step}>{r}</li>)}
        </ul>
      </section>

      <p style={s.foot}>
        Vous avez masqué des aides et voulez les revoir ?{' '}
        <button
          onClick={() => { reafficherAides(); setAidesReaffichees(true) }}
          style={s.linkBtn}
          disabled={aidesReaffichees}
        >
          {aidesReaffichees ? 'Aides réaffichées ✓' : 'Réafficher les aides'}
        </button>
      </p>
    </main>
  )
}

// Charte DESIGN.md : marine #1a2e44, accent #c07828, texte atténué #5a7083
const s: Record<string, React.CSSProperties> = {
  main: { maxWidth: 760, margin: '0 auto', padding: '32px 20px 64px', fontFamily: 'inherit' },
  back: {
    background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer',
    color: '#c07828', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
  },
  title: { fontFamily: "'Instrument Sans', sans-serif", fontSize: 24, fontWeight: 700, color: '#0f1a25', margin: '8px 0 6px' },
  sub: { fontSize: 15, color: '#5a7083', lineHeight: 1.55, margin: '0 0 24px' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: '#fff', border: '1px solid #dde1e6', borderRadius: 12, padding: '16px 18px' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  num: {
    width: 26, height: 26, borderRadius: '50%', background: '#1a2e44', color: '#fff',
    fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardTitle: { fontSize: 16.5, fontWeight: 600, color: '#0f1a25', margin: 0, flex: 1, minWidth: 140 },
  device: { fontSize: 12, fontWeight: 600, color: '#5a7083', background: '#f1f4f7', borderRadius: 999, padding: '3px 10px' },
  steps: { margin: '10px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 },
  step: { fontSize: 14.5, color: '#0f1a25', lineHeight: 1.5 },
  piege: {
    margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.5, color: '#1a2e44',
    background: '#fef3e2', borderRadius: 8, padding: '8px 12px',
  },
  linkBtn: {
    background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer',
    color: '#c07828', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
  },
  rules: { marginTop: 28 },
  rulesTitle: { fontSize: 13, fontWeight: 700, color: '#8a9eb0', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 },
  foot: { marginTop: 28, fontSize: 13.5, color: '#5a7083' },
}
