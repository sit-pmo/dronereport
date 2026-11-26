import type { InspectionType, RoofMaterial, SeverityLevel, Exploitant, CategorieVol } from '../types'

export const INSPECTION_LABELS: Record<InspectionType, string> = {
  toiture: 'Toiture',
  photovoltaique: 'Photovoltaïque',
}

export const ROOF_MATERIAL_LABELS: Record<RoofMaterial, string> = {
  tuile: 'Tuile',
  ardoise: 'Ardoise',
  terrasse: 'Toiture terrasse',
  bac_acier: 'Bac acier',
  vegetalisee: 'Végétalisée',
  plaques_sous_tuiles: 'Plaques sous tuiles',
}

export const SEVERITY_LABELS = {
  faible: 'Faible',
  modere: 'Modéré',
  grave: 'Grave',
  critique: 'Critique',
} as const

export const SEVERITY_COLORS = {
  faible: '#6b7280',
  modere: '#5a7083',
  grave: '#c07828',
  critique: '#b91c1c',
} as const

// Typologie d'anomalies thermiques PV utilisée sur le terrain (retour pilote).
// `shape` + `color` identifient le type sur le marqueur (symbologie catégorisée
// façon SIG — voir PhotoCanvas.tsx et pdfTemplate.tsx) : un figuré ET une
// couleur fixes par type, redondants entre eux, pour rester lisible même sur
// un rectangle/polygone. La sévérité n'est plus affichée pour le PV (un type =
// une anomalie identifiée sans ambiguïté) ; le champ reste pré-rempli en
// arrière-plan pour ne pas casser le modèle de données partagé avec la Toiture.
export type AnomalyShape = 'circle' | 'diamond' | 'triangle' | 'square' | 'star'

export const PV_ANOMALY_TYPES: { label: string; severity: SeverityLevel; shape: AnomalyShape; color: string }[] = [
  { label: 'Hotspot', severity: 'grave', shape: 'circle', color: '#c07828' },
  { label: 'Bypass', severity: 'grave', shape: 'diamond', color: '#0e7490' },
  { label: 'Chaotique : points chauds partout', severity: 'grave', shape: 'triangle', color: '#7c3aed' },
  { label: 'String éteinte', severity: 'modere', shape: 'square', color: '#be185d' },
]

// 5e figuré pour une anomalie décrite en texte libre par le pilote (ne correspond à
// aucun des 4 types fixes ci-dessus) — étoile pour rester visuellement distincte des
// 4 silhouettes pleines, couleur neutre car elle ne désigne pas un type unique précis.
export const PV_CUSTOM_SHAPE: AnomalyShape = 'star'
export const PV_CUSTOM_COLOR = '#5a7083'
export const PV_CUSTOM_LABEL = 'Autre (texte libre)'

// Typologie d'anomalies de couverture courantes (sources : diagnostics
// couvreur, blogs d'inspection toiture par drone), sévérité pré-suggérée,
// éditable par le pilote au clic. Scindée par matériau — certains défauts
// (clivage d'ardoise, glissement de tuile) sont spécifiques à l'un ou l'autre.
const ROOF_ANOMALY_COMMON: { label: string; severity: SeverityLevel }[] = [
  { label: 'Trace d\'infiltration / humidité', severity: 'grave' },
  { label: 'Faîtage descellé ou dégradé', severity: 'grave' },
  { label: 'Solin ou abergement décollé', severity: 'modere' },
  { label: 'Zinguerie corrodée ou endommagée', severity: 'modere' },
  { label: 'Gouttière ou chéneau bouché', severity: 'faible' },
  { label: 'Mousse / lichen', severity: 'faible' },
]

const ROOF_ANOMALY_TUILE: { label: string; severity: SeverityLevel }[] = [
  { label: 'Tuile cassée ou fissurée', severity: 'modere' },
  { label: 'Tuile déplacée ou glissée', severity: 'grave' },
  { label: 'Tuile manquante', severity: 'grave' },
]

const ROOF_ANOMALY_ARDOISE: { label: string; severity: SeverityLevel }[] = [
  { label: 'Ardoise fendue ou clivée', severity: 'modere' },
  { label: 'Ardoise déplacée ou manquante', severity: 'grave' },
  { label: 'Crochet d\'ardoise corrodé ou cassé', severity: 'modere' },
]

const ROOF_ANOMALY_TERRASSE: { label: string; severity: SeverityLevel }[] = [
  { label: 'Cloquage de l\'étanchéité', severity: 'grave' },
  { label: 'Fissuration de l\'étanchéité', severity: 'grave' },
  { label: 'Décollage / soulèvement de la membrane', severity: 'grave' },
  { label: 'Relevé d\'étanchéité décollé', severity: 'grave' },
  { label: 'Évacuation bouchée', severity: 'modere' },
  { label: 'Rétention d\'eau / mare', severity: 'modere' },
  { label: 'Acrotère endommagé', severity: 'modere' },
  { label: 'Végétation spontanée', severity: 'faible' },
]

const ROOF_ANOMALY_BAC_ACIER: { label: string; severity: SeverityLevel }[] = [
  { label: 'Perforation', severity: 'grave' },
  { label: 'Fixation manquante ou desserrée', severity: 'grave' },
  { label: 'Déformation de bac', severity: 'grave' },
  { label: 'Corrosion / rouille', severity: 'modere' },
  { label: 'Joint de recouvrement défectueux', severity: 'modere' },
  { label: 'Bavette dégradée', severity: 'modere' },
]

const ROOF_ANOMALY_VEGETALISEE: { label: string; severity: SeverityLevel }[] = [
  { label: 'Drainage obstrué', severity: 'grave' },
  { label: 'Membrane d\'étanchéité exposée', severity: 'grave' },
  { label: 'Relevé endommagé', severity: 'grave' },
  { label: 'Végétation envahissante / espèces indésirables', severity: 'faible' },
  { label: 'Accumulation de déchets', severity: 'faible' },
]

const ROOF_ANOMALY_PLAQUES: { label: string; severity: SeverityLevel }[] = [
  { label: 'Plaque déplacée ou manquante', severity: 'grave' },
  { label: 'Glissement de plaque', severity: 'grave' },
  { label: 'Plaque fissurée ou cassée', severity: 'modere' },
  { label: 'Joint de recouvrement défectueux', severity: 'modere' },
]

export function getRoofAnomalyTypes(materiau?: RoofMaterial): { label: string; severity: SeverityLevel }[] {
  if (materiau === 'ardoise') return [...ROOF_ANOMALY_ARDOISE, ...ROOF_ANOMALY_COMMON]
  if (materiau === 'terrasse') return ROOF_ANOMALY_TERRASSE
  if (materiau === 'bac_acier') return [...ROOF_ANOMALY_BAC_ACIER, ...ROOF_ANOMALY_COMMON]
  if (materiau === 'vegetalisee') return ROOF_ANOMALY_VEGETALISEE
  if (materiau === 'plaques_sous_tuiles') return [...ROOF_ANOMALY_PLAQUES, ...ROOF_ANOMALY_COMMON]
  return [...ROOF_ANOMALY_TUILE, ...ROOF_ANOMALY_COMMON]
}

// Texte par défaut, éditable par le pilote avant génération du rapport.
const BASE_MISSION_LIMITATIONS = `Cette inspection a été réalisée par voie aérienne au moyen d'un drone télépiloté, dans le respect de la réglementation applicable aux aéronefs sans équipage à bord (arrêtés du 3 décembre 2020 relatifs à l'utilisation de l'espace aérien et aux aéronefs civils circulant sans personne à bord, et règlement (UE) 2019/947 de l'Agence de l'Union européenne pour la sécurité aérienne).

Les observations et anomalies relevées dans le présent rapport résultent d'une analyse visuelle des prises de vue aériennes (orthophotographie et/ou imagerie thermique) réalisées à la date d'inspection mentionnée en page de garde, dans les conditions météorologiques alors constatées. Cette inspection ne constitue pas un diagnostic structurel ni un contrôle réglementaire, et ne dispense pas, le cas échéant, du recours à un bureau d'études ou un expert qualifié pour toute anomalie nécessitant une expertise complémentaire.

La précision de détection est limitée par la résolution des prises de vue et par l'accessibilité visuelle des éléments inspectés depuis l'espace aérien : les défauts non visibles depuis l'extérieur, masqués par la végétation, les superstructures ou tout autre obstacle, ne peuvent être détectés. L'état constaté à la date de l'inspection peut évoluer ultérieurement sous l'effet de facteurs climatiques, d'usure ou d'événements postérieurs à la mission.

Le présent rapport est établi à titre informatif pour le compte du client mentionné en page de garde, sur la base des éléments visuels recueillis lors de la mission. Le télépilote ne saurait être tenu responsable des décisions prises sur le seul fondement de ce rapport sans vérification complémentaire appropriée.`

const PV_THERMOGRAPHY_LIMITATIONS = `Pour les inspections de type photovoltaïque, la thermographie aérienne par drone est explicitement reconnue par la norme technique IEC TS 62446-3 (thermographie infrarouge extérieure des installations PV), mais classée comme inspection simplifiée : elle permet de repérer les modules ou strings présentant une anomalie visible, sans constituer un diagnostic détaillé ni une mesure de température absolue certifiée. La norme recommande notamment une irradiance minimale de 600 W/m² dans le plan des modules, un vent inférieur à 4 Beaufort (28 km/h) et l'absence d'encrassement significatif. Ces paramètres n'ont pas fait l'objet d'une mesure instrumentée lors de la présente mission : la conformité totale à cette norme n'est ni revendiquée ni garantie. Les anomalies thermiques signalées doivent être interprétées comme des indices à approfondir par une inspection détaillée si nécessaire, non comme un diagnostic normatif certifié.`

export function getDefaultMissionLimitations(typeInspection?: InspectionType): string {
  return typeInspection === 'photovoltaique'
    ? `${BASE_MISSION_LIMITATIONS}\n\n${PV_THERMOGRAPHY_LIMITATIONS}`
    : BASE_MISSION_LIMITATIONS
}

// ── Édition collectivité ────────────────────────────────────────────────────

/** Structures exploitantes UAS du territoire. */
export const EXPLOITANT_LABELS: Record<Exploitant, string> = {
  CCIO: "CC de l'île d'Oléron",
  CCBM: 'CC du Bassin de Marennes',
  PETR: 'PETR Marennes Oléron',
  SyMONT: 'SyMONT',
  autre: 'Autre',
}

/** Catégories de vol EASA. */
export const CATEGORIE_VOL_LABELS: Record<CategorieVol, string> = {
  A1: 'Ouverte A1',
  A2: 'Ouverte A2',
  A3: 'Ouverte A3',
  'STS-01': 'Spécifique STS-01',
  'STS-02': 'Spécifique STS-02',
  specifique: 'Spécifique (autorisation)',
}

/** Ouvrages de toiture contrôlés, listés dans le PDF (« Éléments contrôlés »). */
export const POINTS_CONTROLE_TOITURE = [
  'Couverture (tuiles, ardoises, bacs)',
  'Faîtage',
  'Rives',
  'Noues',
  'Solins et abergements',
  'Souches de cheminée',
  'Gouttières et chéneaux',
  'Descentes d’eaux pluviales',
  'Relevés d’étanchéité',
  'Lanterneaux, exutoires, puits de lumière',
  'Équipements en toiture (VMC, antennes, PV)',
  'Végétation, mousses, encombrants',
] as const
