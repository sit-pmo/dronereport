/**
 * Encart du menu de gauche, tant que le rapport d'exemple est ouvert et que la
 * visite guidée est fermée : reprendre la visite, ou supprimer l'exemple.
 * (Dans le menu plutôt que flottant : il ne cache aucun bouton de la page.)
 */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useDraft } from '../hooks/useDraft'
import { useExemple } from '../hooks/useExemple'
import { ecouterVisite, visiteActive, lancerVisite, etapeDeReprise } from '../lib/visiteGuidee'

export default function BandeauExemple() {
  const { draft } = useDraft()
  const { pathname } = useLocation()
  const { supprimerExemple } = useExemple()
  const [active, setActive] = useState(visiteActive)

  // Suit les démarrages / arrêts de la visite
  useEffect(() => ecouterVisite(setActive), [])

  // Pas d'exemple ouvert, visite en cours, ou accueil / guide : rien à afficher
  if (!draft?.exemple || active || pathname === '/app' || pathname === '/guide') return null

  return (
    <aside style={s.box} aria-label="Rapport d'exemple">
      <span style={s.titre}>🧪 Rapport d'exemple</span>
      <button onClick={() => void lancerVisite(etapeDeReprise(pathname))} style={s.btn}>
        Reprendre la visite
      </button>
      <button
        onClick={() => { if (confirm("Supprimer le rapport d'exemple et son carnet ?")) supprimerExemple() }}
        style={s.lien}
      >
        Supprimer l'exemple
      </button>
    </aside>
  )
}

// Charte DESIGN.md : marine, accent bronze
const s: Record<string, React.CSSProperties> = {
  box: {
    margin: '0 10px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
    background: 'rgba(192,120,40,0.15)', border: '1px solid rgba(192,120,40,0.45)', color: '#fff',
    borderRadius: 10, padding: '10px 12px', fontSize: 13,
  },
  titre: { fontWeight: 600 },
  btn: {
    background: '#c07828', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px',
    fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  lien: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,.75)', fontSize: 13,
    cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline',
  },
}
