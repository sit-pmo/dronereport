/**
 * Rattachement automatique des notes terrain aux photos du drone.
 *
 * Principe : chaque note est rattachée à la photo prise au plus près dans le
 * temps. L'horloge du drone et celle du téléphone peuvent différer : un
 * décalage (en secondes) corrige toutes les photos d'un coup.
 *
 * Le GPS ne sert qu'à départager deux photos presque simultanées : le
 * téléphone est au sol, à plusieurs dizaines de mètres du drone, donc la
 * distance seule n'est pas fiable.
 */
import type { NoteTerrain, PhotoItem } from '../types'
import { toWallClock } from './photoMeta'

export interface Proposition {
  noteId: string
  /** Photo proposée, ou undefined si aucune photo dans la tolérance. */
  photoId?: string
  /** Écart en secondes entre la note et la photo (après décalage). */
  ecartS?: number
}

/** Écart sous lequel deux photos sont « simultanées » et départagées par le GPS. */
const EGALITE_S = 10

/** Distance en mètres entre deux points (formule de haversine). */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Heure d'une note en millisecondes, ramenée à l'heure murale locale (comme l'EXIF). */
function noteMs(n: NoteTerrain): number {
  return new Date(toWallClock(new Date(n.prisLe))).getTime()
}

/**
 * Propose une photo pour chaque note.
 * @param decalageS secondes à AJOUTER à l'heure des photos (drone en retard → positif)
 * @param toleranceS écart maximal accepté, au-delà la note reste « non rattachée »
 */
export function proposerRattachements(
  notes: NoteTerrain[],
  photos: PhotoItem[],
  decalageS = 0,
  toleranceS = 300,
): Proposition[] {
  // Photos datées uniquement, avec leur heure corrigée
  const datees = photos
    .filter((p) => p.meta?.prisLe)
    .map((p) => ({ p, ms: new Date(p.meta!.prisLe!).getTime() + decalageS * 1000 }))

  return notes.map((n) => {
    const t = noteMs(n)
    let best: { p: PhotoItem; ecart: number; dist: number } | undefined
    for (const { p, ms } of datees) {
      const ecart = Math.abs(ms - t) / 1000
      if (ecart > toleranceS) continue
      const dist = n.gps && p.meta?.gps ? distanceM(n.gps, p.meta.gps) : Infinity
      const meilleur =
        !best ||
        ecart < best.ecart - EGALITE_S ||
        // Quasi-égalité de temps : la plus proche géographiquement l'emporte
        (Math.abs(ecart - best.ecart) <= EGALITE_S && dist < best.dist)
      if (meilleur) best = { p, ecart, dist }
    }
    return best
      ? { noteId: n.id, photoId: best.p.id, ecartS: Math.round(best.ecart) }
      : { noteId: n.id }
  })
}

/**
 * Estime le décalage d'horloge : écart médian entre chaque note et la photo
 * la plus proche (sans tolérance). Utile quand l'horloge du drone n'est pas
 * réglée. Renvoie 0 s'il manque des données.
 */
export function estimerDecalage(notes: NoteTerrain[], photos: PhotoItem[]): number {
  const ms = photos.filter((p) => p.meta?.prisLe).map((p) => new Date(p.meta!.prisLe!).getTime())
  if (!ms.length || !notes.length) return 0
  const ecarts = notes.map((n) => {
    const t = noteMs(n)
    // écart signé vers la photo la plus proche
    return ms.reduce((acc, m) => (Math.abs(t - m) < Math.abs(acc) ? t - m : acc), Infinity)
  })
  ecarts.sort((a, b) => a - b)
  return Math.round(ecarts[Math.floor(ecarts.length / 2)] / 1000)
}
