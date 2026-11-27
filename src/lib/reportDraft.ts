import type { ReportDraft, MissionInfos, PhotoItem } from '../types'
import { idbPut, idbDelete, idbGetAll, STORE_DRAFTS } from './idbStore'

/*
 * Persistance des brouillons.
 *
 * Les pages appellent saveDraft / loadDraft de façon synchrone. On garde donc
 * un cache en mémoire (Map) qui répond tout de suite, et on recopie chaque
 * écriture dans IndexedDB en tâche de fond. Au démarrage, hydrateDrafts()
 * recharge le cache depuis IndexedDB avant d'afficher l'application.
 */
const cache = new Map<string, ReportDraft>()

/** Recharge les brouillons depuis IndexedDB. À appeler avant le rendu (main.tsx). */
export async function hydrateDrafts(): Promise<void> {
  try {
    const all = await idbGetAll<ReportDraft>(STORE_DRAFTS)
    for (const d of all) cache.set(d.sessionUuid, d)
  } catch (err) {
    console.error('[reportDraft] lecture IndexedDB impossible', err)
  }
}

const PILOTE_LOGO_KEY = 'dronereport:logo'
const PILOTE_COMPANY_KEY = 'dronereport:company'

/** Persist the pilote's logo across drafts so it auto-fills on the next report. */
export function savePiloteLogo(dataUrl: string): void {
  localStorage.setItem(PILOTE_LOGO_KEY, dataUrl)
}

/** Load the last saved pilote logo, or null if never set. */
export function loadPiloteLogo(): string | null {
  return localStorage.getItem(PILOTE_LOGO_KEY)
}

/** Remove the saved pilote logo. */
export function clearPiloteLogo(): void {
  localStorage.removeItem(PILOTE_LOGO_KEY)
}

/** Persist the pilote's company name across drafts. */
export function savePiloteCompany(name: string): void {
  localStorage.setItem(PILOTE_COMPANY_KEY, name)
}

/** Load the last saved pilote company name, or null if never set. */
export function loadPiloteCompany(): string | null {
  return localStorage.getItem(PILOTE_COMPANY_KEY)
}

/** Remove the saved pilote company name. */
export function clearPiloteCompany(): void {
  localStorage.removeItem(PILOTE_COMPANY_KEY)
}

export function generateSessionUuid(): string {
  return crypto.randomUUID()
}

/** Enregistre un brouillon (mémoire tout de suite, IndexedDB en arrière-plan). */
export function saveDraft(draft: ReportDraft): void {
  // On retire les champs client-only (_file) avant de stocker
  const clean: ReportDraft = {
    ...draft,
    photos: draft.photos?.map(({ _file, ...p }) => { void _file; return p }),
  }
  cache.set(clean.sessionUuid, clean)
  idbPut(STORE_DRAFTS, clean.sessionUuid, clean).catch((err) =>
    console.error('[reportDraft] écriture IndexedDB impossible', err),
  )
}

/** Lit un brouillon depuis le cache mémoire. */
export function loadDraft(sessionUuid: string): ReportDraft | null {
  return cache.get(sessionUuid) ?? null
}

/** Supprime un brouillon. */
export function deleteDraft(sessionUuid: string): void {
  cache.delete(sessionUuid)
  idbDelete(STORE_DRAFTS, sessionUuid).catch(() => {})
}

/** Tous les brouillons, du plus récent au plus ancien. */
export function findExistingDrafts(): ReportDraft[] {
  return [...cache.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function createPhotoDraft(): ReportDraft {
  return {
    sessionUuid: generateSessionUuid(),
    createdAt: new Date().toISOString(),
    mission: null,
    ortho: null,
    conclusion: '',
  }
}

export function updateDraftMission(draft: ReportDraft, mission: MissionInfos): ReportDraft {
  return { ...draft, mission }
}

export function updateDraftConclusion(draft: ReportDraft, conclusion: string): ReportDraft {
  return { ...draft, conclusion }
}

export function updateDraftOrtho(
  draft: ReportDraft,
  ortho: Omit<PhotoItem, '_file'> | null,
): ReportDraft {
  return { ...draft, ortho }
}

export function updateDraftMissionLimitations(draft: ReportDraft, missionLimitations: string): ReportDraft {
  return { ...draft, missionLimitations }
}

/**
 * Enregistre le plan de situation capturé.
 * `reperes` : repères photos dessinés sur l'image ; `emprise` : zone capturée.
 */
export function updateDraftIgnPlan(
  draft: ReportDraft,
  ignPlanDataUrl: string,
  reperes: ReportDraft['ignPlanReperes'] = [],
  emprise?: ReportDraft['ignPlanEmprise'],
): ReportDraft {
  return { ...draft, ignPlanDataUrl, ignPlanReperes: reperes, ignPlanEmprise: emprise }
}

/** Enregistre la position du bâtiment placée sur le plan de situation. */
export function updateDraftPlanBatiment(draft: ReportDraft, planBatiment: { lat: number; lon: number }): ReportDraft {
  return { ...draft, planBatiment }
}

export function updateDraftPhotos(draft: ReportDraft, photos: PhotoItem[]): ReportDraft {
  return { ...draft, photos }
}

export function persistDraft(draft: ReportDraft): ReportDraft {
  saveDraft(draft)
  return draft
}
