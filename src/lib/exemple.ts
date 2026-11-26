/**
 * Mode « Essayer avec un exemple ».
 *
 * Crée un rapport et un carnet FICTIFS pour découvrir l'outil sans drone :
 * - le carnet imite celui qu'on aurait pris au téléphone (3 notes) ;
 * - les photos sont des toitures dessinées (public/exemple/), avec une heure
 *   de prise de vue ~20 s avant chaque note, pour que le rattachement marche ;
 * - le rapport est marqué `exemple: true` : badge dans la liste, et
 *   suppression en un clic (rapport + carnet).
 *
 * Aucune donnée réelle. L'adresse est celle de la commune seule (pas de rue),
 * pour que le plan de situation se centre sur Saint-Pierre-d'Oléron.
 */
import type { CarnetTerrain, ReportDraft } from '../types'
import { saveDraft, deleteDraft, findExistingDrafts } from './reportDraft'
import { saveCarnet, deleteCarnet } from './notesTerrain'
import { brouillonDepuisCarnet } from './rapportDepuisCarnet'

/** Identifiant fixe : un seul carnet d'exemple à la fois. */
export const ID_CARNET_EXEMPLE = 'exemple-carnet-gymnase'

/** Photos d'exemple servies par le site (base Vite = /dronereport/). */
export const PHOTOS_EXEMPLE = [1, 2, 3].map((i) => `toiture-exemple-${i}.jpg`)

/**
 * Carnet fictif. Heures en UTC : 10:02:30, 10:05:50, 10:09:20 à Paris (heure d'été),
 * soit 10 à 20 s après les photos d'exemple (EXIF 10:02:10, 10:05:40, 10:09:05).
 * Sur un poste réglé sur un autre fuseau, les notes seraient décalées : le
 * réglage « Décalage horloge drone » sert justement à ça.
 */
export function carnetExemple(): CarnetTerrain {
  const gps = { lat: 45.9421, lon: -1.3059, precisionM: 12 }
  return {
    id: ID_CARNET_EXEMPLE,
    titre: 'Gymnase (exemple)',
    creeLe: '2026-08-14T07:55:00.000Z',
    notes: [
      { id: 'exemple-note-1', prisLe: '2026-08-14T08:02:30.000Z', texte: 'Tuile cassée côté rue', gravite: 'grave', gps },
      { id: 'exemple-note-2', prisLe: '2026-08-14T08:05:50.000Z', texte: 'Mousse sur le pan nord', gravite: 'modere', gps },
      { id: 'exemple-note-3', prisLe: '2026-08-14T08:09:20.000Z', texte: 'Gouttière déboîtée', gravite: 'grave', gps },
    ],
  }
}

/** Supprime le ou les rapports d'exemple et le carnet d'exemple de ce navigateur. */
export function supprimerExemple(): void {
  for (const d of findExistingDrafts()) if (d.exemple) deleteDraft(d.sessionUuid)
  deleteCarnet(ID_CARNET_EXEMPLE)
}

/**
 * Crée (ou recrée à neuf) le rapport d'exemple, déjà relié à son carnet.
 * Les champs obligatoires de la mission sont remplis avec des valeurs « (exemple) ».
 */
export function creerExemple(): ReportDraft {
  supprimerExemple()
  const carnet = carnetExemple()
  saveCarnet(carnet)
  const base = brouillonDepuisCarnet(carnet, "17310 Saint-Pierre-d'Oléron")
  const draft: ReportDraft = {
    ...base,
    exemple: true,
    mission: {
      ...base.mission!,
      clientNom: 'Services techniques (exemple)',
      drone: 'DJI (exemple)',
      telepilote: 'Télépilote (exemple)',
    },
  }
  saveDraft(draft)
  return draft
}

/** Télécharge les photos d'exemple du site et les renvoie comme des fichiers choisis à la main. */
export async function chargerPhotosExemple(): Promise<File[]> {
  return Promise.all(
    PHOTOS_EXEMPLE.map(async (nom) => {
      const res = await fetch(`${import.meta.env.BASE_URL}exemple/${nom}`)
      if (!res.ok) throw new Error(`Photo d'exemple introuvable : ${nom}`)
      return new File([await res.blob()], nom, { type: 'image/jpeg' })
    }),
  )
}
