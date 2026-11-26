/**
 * Carnets de notes terrain.
 *
 * Sur le téléphone, le télépilote (ou l'observateur) crée un carnet par
 * mission et y ajoute des notes horodatées. Le carnet est stocké dans le
 * navigateur du téléphone (IndexedDB), puis exporté en .json et importé sur
 * le PC pour être rattaché aux photos du drone.
 */
import type { CarnetTerrain, NoteTerrain } from '../types'
import { idbPut, idbDelete, idbGetAll, STORE_CARNETS } from './idbStore'
import { downloadJson, slugify } from './draftFile'

// Même principe que reportDraft : cache mémoire synchrone + copie IndexedDB.
const cache = new Map<string, CarnetTerrain>()

/** Recharge les carnets depuis IndexedDB (appelé dans main.tsx). */
export async function hydrateCarnets(): Promise<void> {
  try {
    const all = await idbGetAll<CarnetTerrain>(STORE_CARNETS)
    for (const c of all) cache.set(c.id, c)
  } catch (err) {
    console.error('[notesTerrain] lecture IndexedDB impossible', err)
  }
}

/** Tous les carnets, du plus récent au plus ancien. */
export function listCarnets(): CarnetTerrain[] {
  return [...cache.values()].sort((a, b) => b.creeLe.localeCompare(a.creeLe))
}

export function getCarnet(id: string): CarnetTerrain | null {
  return cache.get(id) ?? null
}

/** Enregistre un carnet (mémoire + IndexedDB). */
export function saveCarnet(c: CarnetTerrain): void {
  cache.set(c.id, c)
  idbPut(STORE_CARNETS, c.id, c).catch((err) => console.error('[notesTerrain] écriture impossible', err))
}

export function deleteCarnet(id: string): void {
  cache.delete(id)
  idbDelete(STORE_CARNETS, id).catch(() => {})
}

/** Nouveau carnet vide. */
export function createCarnet(titre: string): CarnetTerrain {
  const c: CarnetTerrain = { id: crypto.randomUUID(), titre: titre.trim() || 'Mission sans titre', creeLe: new Date().toISOString(), notes: [] }
  saveCarnet(c)
  return c
}

/**
 * Lit la position du téléphone. Ne bloque jamais la note : en cas de refus,
 * d'absence de GPS ou de délai dépassé (8 s), renvoie undefined.
 */
export function lirePosition(): Promise<NoteTerrain['gps']> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, precisionM: Math.round(pos.coords.accuracy) }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  })
}

// ── Export / import ─────────────────────────────────────────────────────────

const FORMAT = 'dronereport-collectivite/carnet'

/** Contenu du fichier d'échange téléphone → PC. */
export function carnetToJson(c: CarnetTerrain): object {
  return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), carnet: c }
}

/** Nom de fichier du carnet. */
export function carnetFilename(c: CarnetTerrain): string {
  return `notes-terrain-${slugify(c.titre)}-${c.creeLe.slice(0, 10)}.json`
}

/**
 * Exporte le carnet. Sur téléphone, on passe par le menu « Partager »
 * (mail, Teams, Drive…) quand il existe ; sinon, simple téléchargement.
 */
export async function exportCarnet(c: CarnetTerrain): Promise<void> {
  const nom = carnetFilename(c)
  const json = JSON.stringify(carnetToJson(c))
  const file = new File([json], nom, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: nom })
      return
    } catch (err) {
      // L'utilisateur a fermé le menu : on ne fait rien de plus
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  downloadJson(carnetToJson(c), nom)
}

/** Lit un fichier carnet. Lève une erreur explicite s'il n'est pas valide. */
export function parseCarnet(text: string): CarnetTerrain {
  let data: { format?: string; carnet?: CarnetTerrain }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.")
  }
  if (data.format !== FORMAT || !data.carnet?.id || !Array.isArray(data.carnet.notes)) {
    throw new Error("Ce fichier n'est pas un carnet de notes terrain.")
  }
  return data.carnet
}
