/**
 * Export / import d'un rapport complet dans un fichier .json.
 *
 * Remplace la synchronisation cloud de la version SaaS : pour reprendre un
 * rapport sur un autre poste, on l'exporte puis on l'importe.
 * Le fichier contient les photos (data URL) : il peut peser plusieurs Mo.
 */
import type { ReportDraft } from '../types'

/** Marqueur de format, pour refuser un fichier qui n'est pas un rapport. */
const FORMAT = 'dronereport/rapport'
/** Ancien marqueur (fichiers exportés avant le 27/11/2026) : toujours accepté à l'import. */
const FORMAT_ANCIEN = 'dronereport-collectivite/rapport'
const VERSION = 1

interface DraftFile {
  format: typeof FORMAT | typeof FORMAT_ANCIEN
  version: number
  exportedAt: string
  draft: ReportDraft
}

/** Déclenche le téléchargement d'un fichier .json à partir d'un objet. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Laisse le temps au navigateur de lancer le téléchargement
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nom de fichier sans caractères gênants. */
export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'rapport'
}

/** Exporte un rapport en .json. */
export function exportDraftFile(draft: ReportDraft): void {
  const file: DraftFile = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), draft }
  const nom = slugify(draft.mission?.batiment || draft.mission?.clientNom || 'rapport')
  const date = draft.mission?.date ?? draft.createdAt.slice(0, 10)
  downloadJson(file, `rapport-drone-${nom}-${date}.json`)
}

/** Lit un fichier exporté. Lève une erreur explicite si le fichier n'est pas valide. */
export function parseDraftFile(text: string): ReportDraft {
  let data: Partial<DraftFile>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.")
  }
  if ((data.format !== FORMAT && data.format !== FORMAT_ANCIEN) || !data.draft?.sessionUuid) {
    throw new Error("Ce fichier n'est pas un rapport DroneReport.")
  }
  if ((data.version ?? 0) > VERSION) {
    throw new Error('Ce rapport vient d\'une version plus récente de l\'outil. Rechargez la page.')
  }
  return data.draft
}
