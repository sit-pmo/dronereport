import { useLocation, useNavigate } from 'react-router-dom'
import { useDraft } from '../hooks/useDraft'
import type { ReactNode } from 'react'
import BandeauExemple from './BandeauExemple'

// Étapes du parcours (édition collectivité : plus d'étape Paiement)
const STEPS = [
  { path: '/app', label: 'Accueil', n: 1 },
  { path: '/mission', label: 'Mission', n: 2 },
  { path: '/photos', label: 'Photos & annotations', n: 3 },
  { path: '/preview', label: 'Aperçu PDF', n: 4 },
]

export default function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { draft } = useDraft()

  const steps = STEPS
  const paths = steps.map((s) => s.path)
  // Pages rattachées à l'étape « Photos » (flux ortho, flux sans ortho, notes terrain)
  const photosAliases = ['/annotate', '/situation', '/photos-terrain', '/rattacher-notes']
  const resolvedPath =
    photosAliases.includes(pathname) || pathname.startsWith('/annotate-terrain')
      ? '/photos'
      : pathname
  const currentIdx = pathname === '/guide' ? -1 : Math.max(0, paths.indexOf(resolvedPath))

  /** Une étape n'est cliquable que si les précédentes sont remplies. */
  function accessible(idx: number): boolean {
    if (idx <= currentIdx) return true
    if (idx <= 1) return true
    if (idx === 2) return !!draft?.mission
    return draft?.ortho?.status === 'done' || (draft?.photos ?? []).some((p) => p.status === 'done')
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div style={{ ...sb.brand, flexWrap: 'wrap' }}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" style={sb.brandLogo} />
          <span style={sb.brandName}>DroneReport</span>
          <span style={sb.brandTag}>collectivité</span>
        </div>

        <nav style={sb.nav}>
          {steps.map((step, i) => {
            const done = i < currentIdx
            const active = i === currentIdx
            const canNav = accessible(i)
            return (
              <button
                key={step.path}
                onClick={() => canNav && navigate(step.path)}
                style={{
                  ...sb.step,
                  ...(active ? sb.stepActive : done ? sb.stepDone : sb.stepFuture),
                  cursor: canNav ? 'pointer' : 'default',
                }}
              >
                <span style={{ ...sb.badge, ...(active ? sb.badgeActive : done ? sb.badgeDone : {}) }}>
                  {done ? '✓' : step.n}
                </span>
                {step.label}
              </button>
            )
          })}
        </nav>

        {/* Rapport d'exemple : reprendre la visite / supprimer */}
        <BandeauExemple />

        {/* Guide toujours accessible, quel que soit l'avancement */}
        <button
          onClick={() => navigate('/guide')}
          style={{ ...sb.guideLink, ...(pathname === '/guide' ? sb.guideLinkActive : {}) }}
        >
          📘 Guide
        </button>

        <div style={sb.footerNote}>
          Données stockées dans ce navigateur uniquement.
        </div>
      </aside>

      <div className="app-content">{children}</div>
    </div>
  )
}

const sb: Record<string, React.CSSProperties> = {
  guideLink: {
    margin: '0 10px 8px', padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: 'rgba(255,255,255,0.75)', fontSize: 13.5, textAlign: 'left',
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
  },
  guideLinkActive: { background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 600 },
  brandTag: { fontSize: 10.5, fontWeight: 700, color: '#c07828', textTransform: 'uppercase', letterSpacing: '0.05em', flexBasis: '100%', paddingLeft: 38, marginTop: -6 },
  footerNote: { marginTop: 'auto', fontSize: 11.5, color: '#8a9eb0', lineHeight: 1.5, padding: '16px 20px' },
  brand: {
    padding: '28px 20px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 28,
    height: 28,
    flexShrink: 0,
    filter: 'brightness(0) invert(1)',
  },
  brandName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Instrument Sans', sans-serif",
    letterSpacing: '-0.02em',
  },
  nav: {
    padding: '12px 10px',
    flex: 1,
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    background: 'transparent',
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    borderLeft: 'none',
    borderRadius: 8,
    paddingTop: 9,
    paddingRight: 10,
    paddingBottom: 9,
    paddingLeft: 10,
    fontSize: 13.5,
    fontFamily: "'DM Sans', sans-serif",
    textAlign: 'left' as const,
    marginBottom: 2,
    transition: 'background 0.15s',
  },
  stepActive: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontWeight: 600,
    borderLeft: '3px solid #c07828',
    paddingLeft: 7,
  },
  stepDone: {
    color: 'rgba(255,255,255,0.6)',
  },
  stepFuture: {
    color: 'rgba(255,255,255,0.3)',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeActive: {
    background: '#c07828',
    color: '#fff',
  },
  badgeDone: {
    background: 'rgba(255,255,255,0.18)',
    color: '#fff',
  },
  pricing: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
  },
  pricingMain: {
    fontSize: 13,
    fontWeight: 600,
    color: '#c07828',
  },
  pricingSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  userInfo: {
    padding: '14px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    overflow: 'hidden',
  },
  userDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#4ade80',
    flexShrink: 0,
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  planName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#c07828',
  },
  quotaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  signOutBtn: {
    marginTop: 6,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    transition: 'color 0.15s',
  },
  helpCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '8px 10px 0',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 12px',
    textDecoration: 'none',
  },
  helpIcon: {
    fontSize: 16,
    flexShrink: 0,
    color: 'rgba(255,255,255,0.45)',
  },
  helpTitle: {
    display: 'block',
    fontSize: 12.5,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.3,
  },
  helpSub: {
    display: 'block',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 1.3,
    marginTop: 2,
  },
  footer: {
    padding: '10px 20px 20px',
  },
  footerLink: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textDecoration: 'none',
  },
}
