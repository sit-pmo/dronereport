/**
 * Démarrer / supprimer le rapport d'exemple depuis n'importe quel écran
 * (accueil, guide, bandeau).
 */
import { useNavigate } from 'react-router-dom'
import { useDraft } from './useDraft'
import { creerExemple, supprimerExemple } from '../lib/exemple'
import { lancerVisite, arreterVisite } from '../lib/visiteGuidee'

export function useExemple() {
  const navigate = useNavigate()
  const { draft, setDraft } = useDraft()

  /**
   * Crée un exemple neuf et lance la visite guidée depuis l'accueil
   * (première étape : importer un carnet ou partir d'un rapport vierge).
   */
  function demarrerExemple() {
    const d = creerExemple()
    setDraft(d)
    navigate('/app')
    void lancerVisite(0)
  }

  /** Supprime l'exemple (rapport + carnet) et revient à l'accueil. */
  function supprimer() {
    arreterVisite()
    supprimerExemple()
    if (draft?.exemple) setDraft(null)
    navigate('/app')
  }

  return { demarrerExemple, supprimerExemple: supprimer }
}
