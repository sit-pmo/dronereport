/**
 * Début de rapport à partir d'un carnet de notes terrain.
 *
 * Quand on importe un carnet sur le PC, on peut créer un rapport déjà
 * pré-rempli avec ce que le carnet sait :
 * - le bâtiment = titre du carnet ;
 * - la date de mission = jour de la première note (heure du téléphone) ;
 * - l'adresse = adresse la plus proche du point GPS le plus précis
 *   (Base Adresse Nationale, à vérifier dans le formulaire) ;
 * - le carnet est lié au rapport : « Rattacher les notes terrain » le
 *   retrouve tout seul, sans réimporter le fichier.
 *
 * Le reste (exploitant, télépilote, drone, météo…) se saisit dans
 * « Informations mission », comme pour un rapport vierge.
 */
import type { CarnetTerrain, MissionInfos, NoteTerrain, ReportDraft } from '../types'
import { createPhotoDraft } from './reportDraft'

/** Au-delà de cette précision (en mètres), le GPS du téléphone ne sert pas à trouver l'adresse. */
export const PRECISION_MAX_ADRESSE_M = 150

/** Date locale AAAA-MM-JJ d'un horodatage ISO (évite le décalage UTC de toISOString). */
function dateLocale(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const jj = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${jj}`
}

/** Jour de mission : celui de la première note, sinon celui de création du carnet. */
export function dateMission(c: CarnetTerrain): string {
  const premiere = [...c.notes].sort((a, b) => a.prisLe.localeCompare(b.prisLe))[0]
  return dateLocale(premiere?.prisLe ?? c.creeLe)
}

/**
 * Point GPS le plus précis du carnet, s'il est assez précis pour chercher une adresse.
 * Une note sans précision connue passe après celles qui en ont une.
 */
export function meilleurPointGps(c: CarnetTerrain): NoteTerrain['gps'] | undefined {
  const avecGps = c.notes.map((n) => n.gps).filter((g): g is NonNullable<NoteTerrain['gps']> => !!g)
  avecGps.sort((a, b) => (a.precisionM ?? Infinity) - (b.precisionM ?? Infinity))
  const best = avecGps[0]
  if (!best) return undefined
  if (best.precisionM !== undefined && best.precisionM > PRECISION_MAX_ADRESSE_M) return undefined
  return best
}

/** Informations mission pré-remplies (mêmes valeurs par défaut que le formulaire vierge). */
export function missionDepuisCarnet(c: CarnetTerrain, adresse = ''): MissionInfos {
  return {
    clientNom: '',
    clientEmail: '',
    adresse,
    date: dateMission(c),
    typeInspection: 'toiture',
    materiauToiture: 'tuile',
    meteo: 'Ensoleillé',
    drone: '',
    notes: '',
    categorieVol: 'A2',
    pointsControle: [],
    batiment: c.titre.trim(),
  }
}

/** Nouveau brouillon de rapport, lié au carnet. */
export function brouillonDepuisCarnet(c: CarnetTerrain, adresse = ''): ReportDraft {
  return { ...createPhotoDraft(), mission: missionDepuisCarnet(c, adresse), carnetId: c.id }
}

/**
 * Adresse la plus proche d'un point (géocodage inverse de la Base Adresse Nationale,
 * service déjà utilisé pour le plan de situation). Renvoie '' si rien ou hors ligne.
 */
export async function adresseProche(lat: number, lon: number): Promise<string> {
  try {
    // Délai court : sans réseau, on crée le rapport sans adresse plutôt que d'attendre
    const res = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lon}&limit=1`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return ''
    const json = await res.json()
    const label = json.features?.[0]?.properties?.label
    return typeof label === 'string' ? label : ''
  } catch {
    return ''
  }
}
