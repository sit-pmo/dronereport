/**
 * Remplace l'envoi des photos vers Supabase Storage.
 *
 * La photo, déjà réduite (1200 px / 200 Ko), est convertie en data URL et
 * stockée directement dans le brouillon (IndexedDB). Elle ne quitte jamais
 * le poste.
 */
import { blobToDataUrl } from './imageUtils'

/** Renvoie une URL utilisable dans <img src> et dans le PDF. */
export async function storePhotoLocally(blob: Blob): Promise<string> {
  return blobToDataUrl(blob)
}
