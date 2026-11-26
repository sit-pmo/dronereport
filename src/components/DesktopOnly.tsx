import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import type { ReactNode } from 'react'

// Garde-fou contraintes.md : "PWA mobile-first, terrain : pas d'outil de
// dessin en V1" — l'upload d'ortho et l'annotation sont des tâches de bureau,
// pas de terrain. Un utilisateur mobile garde l'accès à ses rapports (Accueil,
// re-téléchargement PDF) mais pas à la création/édition.
export default function DesktopOnly({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  if (!isMobile) return <>{children}</>

  return (
    <main style={s.main}>
      <div style={s.icon}>💻</div>
      <h1 style={s.title}>Cette étape nécessite un ordinateur</h1>
      <p style={s.desc}>
        L'envoi de l'ortho et l'annotation des anomalies demandent un grand écran.
        Reprenez ce rapport depuis un ordinateur pour continuer.
      </p>
      <button onClick={() => navigate('/app')} style={s.btn}>
        Retour à mes rapports
      </button>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { padding: '80px 40px', maxWidth: 440, margin: '0 auto', textAlign: 'center', fontFamily: "'Manrope', sans-serif" },
  icon: { width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 28px', background: '#f0f5f9' },
  title: { fontSize: 22, fontWeight: 700, color: '#0f1a25', marginBottom: 12 },
  desc: { fontSize: 15, color: '#5a7083', lineHeight: 1.6, marginBottom: 32 },
  btn: { background: '#1a2e44', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'Manrope', sans-serif", minHeight: 48 },
}
