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

  /** Crée un exemple neuf, ouvre le formulaire mission et lance la visite guidée. */
  function demarrerExemple() {
    const d = creerExemple()
    setDraft(d)
    navigate('/mission')
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
