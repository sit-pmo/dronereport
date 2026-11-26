/**
 * Mémorise les aides que l'utilisateur a masquées (carte d'accueil, bandeaux
 * « À quoi sert cet écran »).
 *
 * Simple confort : stocké dans le localStorage de ce navigateur. Si le
 * stockage est indisponible (navigation privée, stockage bloqué), les aides
 * s'affichent normalement et le choix « Masquer » ne dure que la session.
 */

const CLE = 'dronereport-aides-masquees'

/** Lit la liste des aides masquées. Liste vide si le stockage est illisible. */
function lire(): string[] {
  try {
    const brut = localStorage.getItem(CLE)
    const liste = brut ? JSON.parse(brut) : []
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Écrit la liste, sans planter si le stockage est bloqué. */
function ecrire(liste: string[]): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste))
  } catch {
    // Stockage indisponible : le choix ne sera pas retenu, sans gravité
  }
}

/** Vrai si l'aide `id` a été masquée sur ce navigateur. */
export function aideMasquee(id: string): boolean {
  return lire().includes(id)
}

/** Masque l'aide `id` pour les prochaines visites. */
export function masquerAide(id: string): void {
  const liste = lire()
  if (!liste.includes(id)) ecrire([...liste, id])
}

/** Réaffiche toutes les aides (bouton de la page Guide). */
export function reafficherAides(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    // Rien à faire
  }
}
