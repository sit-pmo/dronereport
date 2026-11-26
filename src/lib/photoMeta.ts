/**
 * Lecture des métadonnées d'une photo drone (EXIF + XMP DJI).
 *
 * On lit le fichier ORIGINAL (avant réduction), car la réduction en canvas
 * supprime toutes les métadonnées.
 *
 * Champs utilisés :
 * - DateTimeOriginal : heure de prise de vue, en heure locale du drone (sans fuseau).
 * - GPSLatitude / GPSLongitude : position du drone.
 * - XMP drone-dji:RelativeAltitude : hauteur par rapport au décollage.
 */
import exifr from 'exifr'
import type { PhotoMeta } from '../types'

/** Formate une date en « heure murale » locale : YYYY-MM-DDTHH:mm:ss (sans fuseau). */
export function toWallClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** Convertit une valeur numérique éventuellement texte (« +42.30 ») en nombre. */
function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/** Lit les métadonnées utiles. Ne lève jamais d'erreur : renvoie {} si rien n'est lisible. */
export async function readPhotoMeta(file: File | Blob): Promise<PhotoMeta> {
  try {
    const t = await exifr.parse(file, { tiff: true, exif: true, gps: true, xmp: true })
    if (!t) return {}
    const meta: PhotoMeta = {}
    // exifr construit la Date en heure locale à partir de la chaîne EXIF sans fuseau :
    // on la reformate telle quelle pour garder l'heure affichée par le drone.
    const dt = t.DateTimeOriginal ?? t.CreateDate
    if (dt instanceof Date && !isNaN(dt.getTime())) meta.prisLe = toWallClock(dt)
    if (typeof t.latitude === 'number' && typeof t.longitude === 'number') {
      meta.gps = { lat: t.latitude, lon: t.longitude }
    }
    const alt = num(t.RelativeAltitude)
    if (alt !== undefined) meta.altitudeRelativeM = alt
    const appareil = [t.Make, t.Model].filter(Boolean).join(' ')
    if (appareil) meta.appareil = appareil
    return meta
  } catch {
    return {}
  }
}
