/**
 * Repères des photos terrain sur le plan de situation (parcours sans ortho).
 *
 * Fonctions pures, sans Leaflet ni canvas, pour être testées facilement :
 * - numérotation des photos dans l'ordre du PDF ;
 * - position à afficher pour une photo (corrigée, sinon GPS du drone) ;
 * - passage lat/lon → pixel dans l'image capturée ;
 * - repères hors de l'emprise affichée.
 */
import type { PhotoItem, ReportDraft } from '../types'

/** Position géographique (degrés WGS84). */
export interface LatLon { lat: number; lon: number }

/** Emprise d'une carte (degrés WGS84). */
export interface Emprise { nord: number; sud: number; est: number; ouest: number }

/**
 * Photos qui auront une page dans le PDF, dans l'ordre du PDF.
 * Doit rester aligné sur pdfTemplate.tsx : `photos.filter(status === 'done')`,
 * dans l'ordre du brouillon (ordre d'import), page « Photo 1 », « Photo 2 »…
 */
export function photosDuPdf(photos: PhotoItem[] | undefined): PhotoItem[] {
  return (photos ?? []).filter((p) => p.status === 'done')
}

/** Numéro de repère de chaque photo (= numéro « Photo N » du PDF), par identifiant. */
export function numerosPhotos(photos: PhotoItem[] | undefined): Map<string, number> {
  return new Map(photosDuPdf(photos).map((p, i) => [p.id, i + 1]))
}

/**
 * Position à afficher sur le plan : celle corrigée par l'utilisateur,
 * sinon le GPS du drone (position de départ, souvent décalée du point photographié).
 */
export function positionPhoto(photo: PhotoItem): LatLon | undefined {
  return photo.position ?? photo.meta?.gps
}

/** Vrai si le point est dans l'emprise (bords inclus). */
export function dansEmprise(p: LatLon, e: Emprise): boolean {
  return p.lat <= e.nord && p.lat >= e.sud && p.lon <= e.est && p.lon >= e.ouest
}

/**
 * Coordonnées en pixels d'un point dans une image couvrant l'emprise.
 * Interpolation linéaire en degrés : c'est ce que fait le WMS demandé en EPSG:4326
 * (la capture d'IGN est une image en lat/lon, pas en Web Mercator).
 */
export function versPixel(p: LatLon, e: Emprise, largeur: number, hauteur: number): { x: number; y: number } {
  const fx = (p.lon - e.ouest) / (e.est - e.ouest)
  const fy = (e.nord - p.lat) / (e.nord - e.sud)
  return { x: Math.round(fx * largeur), y: Math.round(fy * hauteur) }
}

/** Repère prêt à dessiner : numéro de photo + position. */
export interface Repere { id: string; numero: number; pos: LatLon }

/** Repères de toutes les photos du PDF qui ont une position (corrigée ou GPS). */
export function reperesPhotos(photos: PhotoItem[] | undefined): Repere[] {
  return photosDuPdf(photos).flatMap((p, i) => {
    const pos = positionPhoto(p)
    return pos ? [{ id: p.id, numero: i + 1, pos }] : []
  })
}

/** Repère tel qu'enregistré dans le brouillon à la capture du plan. */
export type ReperePlan = NonNullable<ReportDraft['ignPlanReperes']>[number]

/** Repères au format enregistré dans le brouillon (draft.ignPlanReperes). */
export function versReperesPlan(reperes: Repere[]): ReperePlan[] {
  return reperes.map((r) => ({ id: r.id, numero: r.numero, lat: r.pos.lat, lon: r.pos.lon }))
}

/**
 * Numéro du repère dessiné sur le plan pour cette photo, s'il correspond encore
 * à son numéro dans le PDF (sinon undefined : pas de renvoi trompeur).
 */
export function numeroSurLePlan(draft: ReportDraft, photoId: string): number | undefined {
  const dessine = draft.ignPlanReperes?.find((r) => r.id === photoId)
  return dessine && numerosPhotos(draft.photos).get(photoId) === dessine.numero ? dessine.numero : undefined
}

/**
 * Vrai si le plan capturé ne reflète plus les repères actuels :
 * repère déplacé, renuméroté (photo ajoutée avant / supprimée), retiré,
 * ou nouveau repère tombant dans l'emprise capturée.
 * Faux s'il n'y a ni plan ni repère.
 */
export function planPerime(draft: ReportDraft): boolean {
  if (!draft.ignPlanDataUrl) return false
  const actuels = reperesPhotos(draft.photos)
  const dessines = draft.ignPlanReperes ?? []
  const parId = new Map(actuels.map((r) => [r.id, r]))
  // Un repère dessiné a changé (numéro, position) ou n'existe plus
  for (const d of dessines) {
    const a = parId.get(d.id)
    if (!a || a.numero !== d.numero || a.pos.lat !== d.lat || a.pos.lon !== d.lon) return true
  }
  // Un repère actuel aurait dû être dessiné (il tombe dans l'emprise capturée)
  const emprise = draft.ignPlanEmprise
  if (!emprise) return false // plan capturé avant cette fonctionnalité : on ne sait pas
  const ids = new Set(dessines.map((d) => d.id))
  return actuels.some((r) => !ids.has(r.id) && dansEmprise(r.pos, emprise))
}
