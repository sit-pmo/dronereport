/**
 * Bandeau « À quoi sert cet écran », en haut des écrans clés.
 *
 * Une ou deux phrases, un lien vers le guide, et « Masquer » qui retient le
 * choix sur ce navigateur (voir lib/aidesVues.ts).
 */
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { aideMasquee, masquerAide } from '../lib/aidesVues'

interface Props {
  /** Identifiant stable de l'aide (sert à mémoriser « Masquer »). */
  id: string
  /** Texte de l'aide. */
  children: ReactNode
}

export default function AideEcran({ id, children }: Props) {
  const navigate = useNavigate()
  // Lu une seule fois au montage : l'aide ne réapparaît pas en cours de page
  const [visible, setVisible] = useState(() => !aideMasquee(id))
  if (!visible) return null

  return (
    <aside style={s.box} aria-label="Aide sur cet écran">
      <span style={s.icon} aria-hidden="true">💡</span>
      <div style={s.body}>
        <div style={s.text}>{children}</div>
        <div style={s.actions}>
          <button onClick={() => navigate('/guide')} style={s.link}>Voir le guide</button>
          <button
            onClick={() => { masquerAide(id); setVisible(false) }}
            style={s.close}
          >
            Masquer
          </button>
        </div>
      </div>
    </aside>
  )
}

// Couleurs de la charte (DESIGN.md) : fond accent-bg, texte marine
const s: Record<string, React.CSSProperties> = {
  box: {
    display: 'flex',
    gap: 10,
    background: '#fef3e2',
    border: '1px solid #f3d9b1',
    borderRadius: 10,
    padding: '10px 14px',
    margin: '0 0 18px',
    fontSize: 13.5,
    lineHeight: 1.5,
    color: '#1a2e44',
  },
  icon: { fontSize: 16, lineHeight: 1.4, flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
  text: {},
  actions: { display: 'flex', gap: 16, marginTop: 4 },
  link: {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    color: '#c07828', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
  },
  close: {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    color: '#5a7083', fontSize: 13, fontFamily: 'inherit',
  },
}
