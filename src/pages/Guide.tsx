/**
 * Page « Guide » : le parcours complet pour quelqu'un qui découvre l'outil.
 *
 * Chaque étape montre des captures annotées : repères numérotés + légende.
 * Lisible sur ordinateur et sur téléphone. Sur téléphone, on n'affiche que
 * les étapes faites au téléphone (les autres se font au bureau), avec un
 * lien pour tout voir.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ETAPES_GUIDE, REGLES_GUIDE, capturesEtape, urlCapture, type CaptureGuide } from '../lib/guide'
import { reafficherAides } from '../lib/aidesVues'
import { useIsMobile } from '../hooks/useIsMobile'
import { useExemple } from '../hooks/useExemple'

export default function Guide() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { demarrerExemple } = useExemple()
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
      {/* Sur ordinateur : la pratique avant la lecture */}
      {!isMobile && (
        <div style={s.essai}>
          <div>
            <strong>Le plus simple : essayer.</strong> Un rapport d'exemple (données fictives) et une visite guidée
            vous font faire tout le parcours, des notes au PDF, en 5 minutes.
          </div>
          <button onClick={demarrerExemple} style={s.essaiBtn}>🧪 Essayer avec un exemple</button>
        </div>
      )}

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
            {capturesEtape(e.n).map((c) => <Capture key={c.id} capture={c} />)}
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

/**
 * Une capture annotée : image (cliquable pour l'agrandir) et légende des repères.
 * Les numéros de la légende correspondent aux pastilles posées sur l'image.
 */
function Capture({ capture }: { capture: CaptureGuide }) {
  const tel = capture.appareil === 'Téléphone'
  const src = urlCapture(capture)
  return (
    <figure style={s.figure}>
      <figcaption style={s.figTitre}>{capture.titre}</figcaption>
      <div style={{ ...s.figCorps, ...(tel ? s.figCorpsTel : {}) }}>
        <a href={src} target="_blank" rel="noreferrer" title="Agrandir la capture" style={tel ? s.imgLienTel : s.imgLien}>
          <img src={src} alt={`Capture : ${capture.titre}`} loading="lazy" style={s.img} />
        </a>
        <ol style={s.legende}>
          {capture.reperes.map((r) => (
            <li key={r.n} style={s.legendeItem}>
              <span style={s.pastille} aria-hidden="true">{r.n}</span>
              <span>{r.legende}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
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
  essai: {
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between',
    background: '#1a2e44', color: '#fff', borderRadius: 12, padding: '14px 18px', margin: '0 0 24px', fontSize: 14.5, lineHeight: 1.5,
  },
  essaiBtn: {
    background: '#c07828', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px',
    fontWeight: 600, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
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
  figure: { margin: '16px 0 0', borderTop: '1px solid #eef0f3', paddingTop: 14 },
  figTitre: { fontSize: 13, fontWeight: 700, color: '#5a7083', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 },
  figCorps: { display: 'flex', flexDirection: 'column', gap: 12 },
  // Téléphone : capture étroite à gauche, légende à droite (en colonne sur petit écran)
  figCorpsTel: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  imgLien: { display: 'block' },
  imgLienTel: { display: 'block', width: 240, maxWidth: '100%', flexShrink: 0 },
  img: { display: 'block', width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #dde1e6' },
  legende: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 220px' },
  legendeItem: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.45, color: '#0f1a25' },
  pastille: {
    width: 24, height: 24, borderRadius: '50%', background: '#c07828', color: '#fff', fontSize: 12.5, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  foot: { marginTop: 28, fontSize: 13.5, color: '#5a7083' },
}
