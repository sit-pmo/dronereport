export type InspectionType = 'toiture' | 'photovoltaique'

export type RoofMaterial = 'tuile' | 'ardoise' | 'terrasse' | 'bac_acier' | 'vegetalisee' | 'plaques_sous_tuiles'

export type SeverityLevel = 'faible' | 'modere' | 'grave' | 'critique'

export type PhotoStatus = 'pending' | 'uploading' | 'done' | 'failed'

export type ReportStatus = 'draft' | 'paid' | 'delivered'

export interface PhotoAnnotation {
  id: string
  type: 'pin' | 'rect' | 'polygon'
  label: string                      // commentaire
  severity: SeverityLevel
  x: number                          // pin = centre ; rect = left edge ; polygon = centroïde (normalisé 0–1)
  y: number                          // pin = centre ; rect = top edge ; polygon = centroïde (normalisé 0–1)
  w?: number                         // rect only, largeur normalisée
  h?: number                         // rect only, hauteur normalisée
  points?: { x: number; y: number }[] // polygon only, sommets normalisés 0–1
  noteId?: string                    // note terrain d'origine (rattachement), évite les doublons
  photoUrl?: string                  // gros plan joint — Toiture uniquement, jamais peuplé en Photovoltaïque
}

export type Measure =
  | {
      id: string
      kind: 'line'
      x1: number; y1: number
      x2: number; y2: number
      distanceM: number
    }
  | {
      id: string
      kind: 'polygon'
      points: { x: number; y: number }[]
      segmentsM: number[]
      areaM2: number
    }

export interface PhotoItem {
  id: string
  name?: string
  storageUrl?: string
  status: PhotoStatus
  progress?: number
  errorMsg?: string
  annotations?: PhotoAnnotation[]
  groundResolution?: { x: number; y: number }
  measurements?: Measure[]
  meta?: PhotoMeta                   // heure + GPS lus dans la photo (rattachement des notes)
  // Position corrigée par l'utilisateur sur le plan de situation (point photographié).
  // Distincte de meta.gps, qui reste intact : c'est la position du drone à la prise de vue.
  position?: { lat: number; lon: number }
  // Client-only — not serialized to localStorage
  _file?: File
}

export interface MissionInfos {
  clientNom: string
  clientEmail: string
  adresse: string
  date: string // ISO date string YYYY-MM-DD
  typeInspection: InspectionType
  materiauToiture?: RoofMaterial // pertinent uniquement si typeInspection === 'toiture'
  meteo: string
  drone: string
  notes?: string
  objetMission?: string
  methodologie?: string
  // ── Mission : bâtiment, exploitant, vol ───────────────────────
  batiment?: string          // nom du bâtiment inspecté (ex. « Gymnase municipal »)
  refPatrimoine?: string     // référence dans l'inventaire du patrimoine bâti
  exploitant?: Exploitant    // structure exploitante UAS (porte la responsabilité du vol)
  telepilote?: string        // nom du télépilote
  categorieVol?: CategorieVol
  cerfaRef?: string          // n° / date de la déclaration préfecture si vol en agglomération
  pointsControle?: string[]  // points de contrôle toiture cochés (voir constants.ts)
}

/** Structures exploitantes possibles. */
export type Exploitant = 'CCIO' | 'CCBM' | 'PETR' | 'SyMONT' | 'autre'

/** Catégorie de vol EASA (cadre seul en vigueur depuis le 1/1/2026). */
export type CategorieVol = 'A1' | 'A2' | 'A3' | 'STS-01' | 'STS-02' | 'specifique'

export interface ReportDraft {
  sessionUuid: string
  createdAt: string // ISO
  mission: MissionInfos | null
  ortho: Omit<PhotoItem, '_file'> | null
  conclusion?: string
  missionLimitations?: string // limites de la mission, éditable, affichée en dernière page du PDF
  logoDataUrl?: string   // base64 data URL — pilote's company logo shown in PDF header
  nomEntreprise?: string // pilote's company name shown next to logo in PDF header
  // true quand ce draft vient de "Modifier" sur un rapport déjà payé (Accueil.tsx) —
  // mission/annotations restent éditables, mais l'ortho est verrouillée : la
  // remplacer reviendrait à régénérer un rapport différent sans recompter de quota.
  orthoLocked?: boolean
  ignPlanDataUrl?: string   // base64 PNG capture carte IGN (flow sans ortho)
  // Repères photos dessinés sur ignPlanDataUrl à la capture (numéro + position), et emprise capturée.
  // Servent au renvoi « repère N » du PDF et à détecter un plan qui n'est plus à jour.
  ignPlanReperes?: { id: string; numero: number; lat: number; lon: number }[]
  ignPlanEmprise?: { nord: number; sud: number; est: number; ouest: number }
  // Position du bâtiment placée sur le plan de situation (marqueur rouge), reprise à chaque retour sur le plan
  planBatiment?: { lat: number; lon: number }
  photos?: PhotoItem[]      // photos terrain individuelles avec annotations (flow sans ortho)
  carnetId?: string         // carnet de notes terrain rattaché à ce rapport
  exemple?: boolean         // rapport d'exemple (mode « Essayer avec un exemple »), données fictives
}

// ── Notes terrain (prises au téléphone pendant le vol) ─────────────────────

/** Une note prise sur le terrain. */
export interface NoteTerrain {
  id: string
  /** Heure de la note, ISO avec fuseau du téléphone. */
  prisLe: string
  texte: string
  gravite?: SeverityLevel
  /** Position du téléphone, si autorisée. Sert seulement à départager. */
  gps?: { lat: number; lon: number; precisionM?: number }
  /** Photo à laquelle la note a été rattachée au bureau. */
  photoId?: string
}

/** Un carnet = toutes les notes d'une mission. */
export interface CarnetTerrain {
  id: string
  titre: string
  creeLe: string
  notes: NoteTerrain[]
}

/** Métadonnées lues dans l'EXIF / XMP d'une photo drone. */
export interface PhotoMeta {
  /** Heure de prise de vue (heure locale de l'appareil, sans fuseau). */
  prisLe?: string
  gps?: { lat: number; lon: number }
  altitudeRelativeM?: number
  appareil?: string
}

export interface ReportRecord {
  id: string
  userId: string
  sessionUuid: string
  downloadToken: string
  status: ReportStatus
  stripeCheckoutSessionId?: string
  missionInfos: MissionInfos
  ortho: Omit<PhotoItem, '_file'> | null
  createdAt: string
  paidAt?: string
  lockedUntil?: string
}
