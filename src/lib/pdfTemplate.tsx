import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  G,
  Path,
  Polygon,
  Circle,
  Rect,
} from '@react-pdf/renderer'
import type { ReportDraft, PhotoAnnotation } from '../types'
import { SEVERITY_LABELS, EXPLOITANT_LABELS, CATEGORIE_VOL_LABELS, INSPECTION_LABELS, getDefaultMissionLimitations, PV_ANOMALY_TYPES, PV_CUSTOM_SHAPE, PV_CUSTOM_COLOR, PV_CUSTOM_LABEL, type AnomalyShape } from './constants'

const SEVERITY_HEX: Record<string, string> = {
  faible: '#9ca3af',
  modere: '#5a7083',
  grave: '#c07828',
  critique: '#b91c1c',
}

// Étoile à 5 branches, viewBox 0–16 (même grille que les 4 autres figurés).
const STAR_POINTS = '8,1.5 9.5,5.9 14.2,6 10.5,8.8 11.8,13.3 8,10.6 4.2,13.3 5.5,8.8 1.8,6 6.5,5.9'

const pdf = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#c07828', paddingBottom: 10, marginBottom: 6 },
  headerPilote: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerBrand: { alignItems: 'flex-end' },
  brand: { fontSize: 18, fontWeight: 700, color: '#1a2e44' },
  brandSub: { fontSize: 9, color: '#5a7083', marginTop: 2 },
  piloteNom: { fontSize: 13, fontWeight: 700, color: '#1a2e44' },
  datesRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  dateItem: { fontSize: 8, color: '#9ca3af' },
  h1: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#1a2e44', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#dde1e6', paddingBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 130, color: '#6b7280' },
  value: { flex: 1 },
  severityGrid: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  severityBox: { flex: 1, borderRadius: 4, padding: '10 6', alignItems: 'center' },
  severityBoxCount: { fontSize: 20, fontWeight: 700, color: '#fff' },
  severityBoxLabel: { fontSize: 8, color: '#fff', marginTop: 3 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 8, color: '#5a7083' },
  indexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  indexCard: { width: '47%', border: 1, borderColor: '#e5e7eb', borderRadius: 4, padding: 10, marginBottom: 4 },
  indexCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  indexCardSev: { borderRadius: 3, padding: '2 6' },
  indexCardSevText: { fontSize: 8, fontWeight: 700, color: '#fff' },
  indexCardDesc: { fontSize: 9, color: '#111827', lineHeight: 1.4, marginBottom: 6 },
  indexCardPhoto: { width: '100%', height: 100, objectFit: 'cover', borderRadius: 3 },
  orthoWrap: { position: 'relative', width: '100%', marginBottom: 10 },
  orthoImg: { width: '100%' },
  badge: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 6, fontWeight: 700, color: '#ffffff' },
  badgeUntyped: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: '#9ca3af' },
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#9ca3af', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  noContent: { color: '#9ca3af' },
  bodyText: { fontSize: 10, lineHeight: 1.6, color: '#0f1a25' },
  coverTitleBlock: { marginTop: 28, marginBottom: 24 },
  coverTitle: { fontSize: 28, fontWeight: 700, color: '#1a2e44', marginBottom: 6 },
  coverSubtitle: { fontSize: 10, fontWeight: 700, color: '#c07828', textTransform: 'uppercase', letterSpacing: 1.5 },
  coverCard: { border: 1, borderColor: '#e5e7eb', borderRadius: 4, padding: 14, marginBottom: 24 },
  coverPhotoWrap: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  coverPhotoImg: { width: '100%', height: 300, objectFit: 'contain' },
  terrainPhotoWrap: { position: 'relative', width: '100%', marginBottom: 6 },
  terrainPhotoImg: { width: '100%' },
  terrainPhotoTitle: { fontSize: 11, fontWeight: 700, color: '#1a2e44', marginBottom: 6 },
})

function DroneReportLogo({ size = 28 }: { size?: number }) {
  return (
    <Svg viewBox="480 148 448 448" style={{ width: size, height: size }}>
      <G transform="translate(0,768) scale(0.1,-0.1)" fill="#1a2e44" stroke="none">
        <Path d="M5745 5869 c-33 -5 -100 -20 -150 -34 -400 -113 -476 -381 -152 -538 141 -69 333 -110 486 -105 98 3 117 18 91 66 -13 23 -23 27 -65 29 -175 8 -354 47 -461 99 -192 94 -196 207 -10 298 214 104 538 128 809 60 166 -41 270 -102 306 -178 19 -42 24 -46 55 -46 39 0 52 14 47 50 -17 131 -206 249 -475 295 -97 16 -377 19 -481 4z" />
        <Path d="M7840 5863 c-235 -42 -420 -151 -451 -268 -14 -50 -2 -70 41 -70 29 0 36 6 56 43 30 56 52 74 149 121 211 103 524 125 791 55 216 -56 338 -150 305 -235 -23 -62 -137 -134 -271 -173 -74 -21 -246 -46 -315 -46 -42 0 -60 -5 -75 -20 -23 -23 -24 -33 -10 -61 9 -16 22 -19 93 -19 238 0 518 90 621 200 108 116 77 262 -77 356 -80 49 -229 101 -347 120 -113 19 -399 17 -510 -3z" />
        <Path d="M5928 5554 c-13 -27 -4 -51 23 -65 8 -5 113 -39 234 -77 121 -38 294 -93 385 -122 91 -28 201 -70 244 -91 44 -22 82 -36 86 -32 42 50 50 66 38 81 -21 25 -141 78 -266 117 -242 77 -530 167 -604 191 -100 31 -125 31 -140 -2z" />
        <Path d="M7990 5548 c-132 -41 -453 -143 -585 -185 -117 -37 -218 -84 -287 -131 -47 -33 -295 -282 -724 -727 -268 -279 -546 -567 -683 -706 -89 -91 -101 -130 -56 -174 24 -25 27 -25 189 -25 l165 0 3 -327 c3 -320 4 -329 26 -375 19 -38 34 -52 76 -73 l52 -25 891 2 891 3 43 30 c75 53 78 71 78 442 l1 322 176 3 c160 3 177 5 190 22 19 27 17 76 -4 109 -10 15 -102 112 -203 215 -101 103 -296 304 -434 447 -137 143 -330 343 -428 444 l-179 183 -36 -36 -36 -35 70 -73 c430 -450 668 -697 982 -1019 72 -75 132 -141 132 -148 0 -9 -39 -12 -165 -9 l-164 3 -3 -377 -3 -377 -23 -23 -23 -23 -867 -2 c-685 -2 -872 0 -892 10 -45 23 -49 56 -49 435 l0 354 -166 -2 c-114 0 -165 3 -165 10 0 9 101 116 290 309 14 14 192 199 395 410 204 212 447 462 540 556 157 158 177 174 255 212 47 23 247 93 450 157 482 152 444 138 448 170 4 35 -14 56 -47 55 -14 0 -69 -14 -121 -31z" />
      </G>
    </Svg>
  )
}

function ReportHeader({ draft, fixed }: { draft: ReportDraft; fixed?: boolean }) {
  return (
    <View style={pdf.header} fixed={fixed}>
      <View style={pdf.headerPilote}>
        {draft.logoDataUrl && (
          <Image src={draft.logoDataUrl} style={{ height: 36, width: 120, objectFit: 'contain', objectPositionX: 'left', objectPositionY: 'center' }} />
        )}
        {draft.nomEntreprise && (
          <Text style={pdf.piloteNom}>{draft.nomEntreprise}</Text>
        )}
      </View>
      <View style={{ ...pdf.headerBrand, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={pdf.brand}>DroneReport</Text>
          <Text style={pdf.brandSub}>Rapport d'inspection drone</Text>
        </View>
        <DroneReportLogo size={36} />
      </View>
    </View>
  )
}

function PageFooter() {
  return (
    <View style={pdf.footer} fixed>
      <Text>DroneReport (édition collectivité) — rapport généré automatiquement</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  )
}

// Silhouette par type d'anomalie PV — même découpage que ShapeGlyph côté canvas
// (PhotoCanvas.tsx). Le numéro reste affiché ici (contrairement au canvas) car
// c'est l'unique repère entre un point sur l'ortho (page 2) et sa fiche dans
// l'index (page 3) — un document statique n'a pas d'équivalent au clic.
function PdfShapeGlyph({ shape, fill, stroke, strokeWidth = 1.4 }: { shape: AnomalyShape; fill: string; stroke: string; strokeWidth?: number }) {
  if (shape === 'circle') return <Circle cx={8} cy={8} r={6.5} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  if (shape === 'square') return <Rect x={2} y={2} width={12} height={12} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  if (shape === 'diamond') return <Polygon points="8,1 15,8 8,15 1,8" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  if (shape === 'star') return <Polygon points={STAR_POINTS} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  return <Polygon points="8,1.5 15,14.5 1,14.5" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
}

function pvTypeFor(label: string) {
  return PV_ANOMALY_TYPES.find((t) => t.label === label)
}

function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function MarkerBadge({ num, pv, shape, typeColor }: { num: number; pv?: boolean; shape?: AnomalyShape; typeColor?: string }) {
  if (pv) {
    if (!shape) {
      // Aucun type choisi (label vide) : neutre, pas de couleur présumée.
      return <View style={pdf.badgeUntyped} />
    }
    // Pas de numéro : sans page d'index, rien à cross-référencer (forme + couleur suffisent).
    // Pas de remplissage : un figuré ponctuel ne doit pas masquer l'ortho thermique
    // sous le point exact qu'il signale — seul le contour porte la couleur du type.
    // Liseré blanc dessous : sans lui, un figuré ton-sur-ton avec l'ortho est quasi invisible.
    return (
      <Svg viewBox="0 0 16 16" style={{ width: 10, height: 10 }}>
        <PdfShapeGlyph shape={shape} fill="none" stroke="#ffffff" strokeWidth={3.5} />
        <PdfShapeGlyph shape={shape} fill="none" stroke={typeColor ?? '#5a7083'} strokeWidth={1.8} />
      </Svg>
    )
  }
  return (
    <View style={pdf.badge}>
      <Text style={pdf.badgeText}>{num}</Text>
    </View>
  )
}

function PvShapeLegend() {
  const entries = [...PV_ANOMALY_TYPES, { label: PV_CUSTOM_LABEL, shape: PV_CUSTOM_SHAPE, color: PV_CUSTOM_COLOR }]
  return (
    <View style={pdf.legendRow}>
      {entries.map((t) => (
        <View key={t.label} style={pdf.legendItem}>
          <Svg viewBox="0 0 16 16" style={{ width: 9, height: 9 }}>
            <PdfShapeGlyph shape={t.shape} fill={t.color} stroke="#ffffff" />
          </Svg>
          <Text style={pdf.legendText}>{t.label}</Text>
        </View>
      ))}
    </View>
  )
}

function OrthoOverlay({ annotations, isPV }: { annotations: PhotoAnnotation[]; isPV: boolean }) {
  return (
    <>
      {annotations.map((ann, i) => {
        const num = i + 1
        const pvType = isPV ? pvTypeFor(ann.label) : undefined
        const isEmpty = isPV && !ann.label
        // Texte libre tapé sans cliquer un type fixe : étoile dédiée (voir légende),
        // pas le pointillé "rien renseigné encore".
        const isCustom = isPV && !pvType && !isEmpty
        const shape = pvType?.shape ?? (isCustom ? PV_CUSTOM_SHAPE : undefined)
        const typeColor = pvType?.color ?? (isCustom ? PV_CUSTOM_COLOR : undefined)
        const shapeColor = isEmpty ? '#9ca3af' : (typeColor ?? SEVERITY_HEX[ann.severity] ?? '#ef4444')
        const fillOpacity = isEmpty ? 0.08 : 0.15
        if (ann.type === 'rect') {
          return (
            <View key={ann.id} style={{
              position: 'absolute',
              left: `${ann.x * 100}%`, top: `${ann.y * 100}%`,
              width: `${(ann.w ?? 0) * 100}%`, height: `${(ann.h ?? 0) * 100}%`,
              borderWidth: 1, borderStyle: isEmpty ? 'dashed' : 'solid', borderColor: shapeColor, backgroundColor: hexToRgba(shapeColor, fillOpacity),
            }}>
              {/* Pas de figuré ponctuel sur une forme déjà surfacique en PV — la couleur
                  de la forme suffit. Conservé pour Toiture : c'est le repère vers l'index. */}
              {!isPV && <MarkerBadge num={num} pv={isPV} shape={shape} typeColor={typeColor} />}
            </View>
          )
        }
        if (ann.type === 'polygon' && ann.points) {
          const pts = ann.points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')
          return (
            <View key={ann.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              <Svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                <Polygon points={pts} fill={shapeColor} fillOpacity={fillOpacity} stroke={shapeColor} strokeWidth={0.3} strokeDasharray={isEmpty ? '1.2 1' : undefined} />
              </Svg>
              {!isPV && (
                <View style={{ position: 'absolute', left: `${ann.x * 100}%`, top: `${ann.y * 100}%`, marginLeft: -5, marginTop: -5 }}>
                  <MarkerBadge num={num} pv={isPV} shape={shape} typeColor={typeColor} />
                </View>
              )}
            </View>
          )
        }
        return (
          <View key={ann.id} style={{ position: 'absolute', left: `${ann.x * 100}%`, top: `${ann.y * 100}%`, marginLeft: -5, marginTop: -5 }}>
            <MarkerBadge num={num} pv={isPV} shape={shape} typeColor={typeColor} />
          </View>
        )
      })}
    </>
  )
}

// Toiture uniquement — la page d'index n'est plus rendue pour le PV (voir ReportPDF).
function IndexCard({ num, ann, photoUrl }: { num: number; ann: PhotoAnnotation; photoUrl?: string }) {
  return (
    <View style={pdf.indexCard} wrap={false}>
      <View style={pdf.indexCardHeader}>
        <MarkerBadge num={num} />
        <View style={{ ...pdf.indexCardSev, backgroundColor: SEVERITY_HEX[ann.severity] ?? '#6b7280' }}>
          <Text style={pdf.indexCardSevText}>{SEVERITY_LABELS[ann.severity]}</Text>
        </View>
      </View>
      <Text style={pdf.indexCardDesc}>{ann.label || '(sans description)'}</Text>
      {photoUrl && <Image src={photoUrl} style={pdf.indexCardPhoto} />}
    </View>
  )
}

interface Props {
  draft: ReportDraft
  // 'cover' = ortho/photo nadir (réutilisée comme couverture), 'ann-<id>' = gros plan par annotation (Toiture)
  photoDataUrls: Map<string, string>
}

export function ReportPDF({ draft, photoDataUrls }: Props) {
  const { mission, ortho } = draft
  const generatedAt = new Date().toLocaleDateString('fr-FR')
  const annotations = ortho?.annotations ?? []
  const isPV = mission?.typeInspection === 'photovoltaique'
  const isSansOrtho = !!draft.ignPlanDataUrl && !ortho

  const sevCount = { faible: 0, modere: 0, grave: 0, critique: 0 }
  for (const a of annotations) {
    if (a.severity in sevCount) sevCount[a.severity as keyof typeof sevCount]++
  }

  return (
    <Document>
      {/* Page 1 — Cover */}
      <Page size="A4" style={pdf.page}>
        <ReportHeader draft={draft} fixed />

        <View style={pdf.coverTitleBlock}>
          <Text style={pdf.coverTitle}>Rapport d'inspection drone</Text>
          {mission && (
            <Text style={pdf.coverSubtitle}>{INSPECTION_LABELS[mission.typeInspection]}</Text>
          )}
        </View>

        <View style={pdf.coverCard}>
          {mission?.batiment && <InfoRow label="Bâtiment" value={mission.batiment} />}
          {mission?.refPatrimoine && <InfoRow label="Réf. patrimoine" value={mission.refPatrimoine} />}
          <InfoRow label="Demandeur" value={mission?.clientNom || '—'} />
          <InfoRow label="Site" value={mission?.adresse || '—'} />
          <InfoRow
            label="Date d'inspection"
            value={mission?.date ? new Date(mission.date).toLocaleDateString('fr-FR') : '—'}
          />
          <InfoRow label="Date de génération" value={generatedAt} />
        </View>

        {(photoDataUrls.has('cover') || (isSansOrtho && photoDataUrls.has('ign'))) && (
          <View style={pdf.coverPhotoWrap}>
            <Image
              src={(photoDataUrls.get('cover') ?? photoDataUrls.get('ign'))!}
              style={pdf.coverPhotoImg}
            />
          </View>
        )}
      </Page>

      {/* Page 2 — Caractéristiques & méthodologie */}
      <Page size="A4" style={pdf.page}>
        <ReportHeader draft={draft} fixed />

        <View style={pdf.datesRow}>
          <Text style={pdf.dateItem}>Généré le {generatedAt}</Text>
          {mission?.date && (
            <Text style={pdf.dateItem}>Inspection : {new Date(mission.date).toLocaleDateString('fr-FR')}</Text>
          )}
        </View>

        {mission && (
          <View style={pdf.section}>
            <Text style={pdf.sectionTitle}>Caractéristiques de la mission</Text>
            <InfoRow label="Type d'inspection" value={INSPECTION_LABELS[mission.typeInspection]} />
            {mission.exploitant && <InfoRow label="Exploitant UAS" value={EXPLOITANT_LABELS[mission.exploitant]} />}
            {mission.telepilote && <InfoRow label="Télépilote" value={mission.telepilote} />}
            <InfoRow label="Drone" value={mission.drone} />
            {mission.categorieVol && <InfoRow label="Catégorie de vol" value={CATEGORIE_VOL_LABELS[mission.categorieVol]} />}
            {mission.cerfaRef && <InfoRow label="Déclaration préfecture" value={mission.cerfaRef} />}
            <InfoRow label="Météo" value={mission.meteo} />
            {mission.notes && <InfoRow label="Notes" value={mission.notes} />}
          </View>
        )}

        {mission?.objetMission && (
          <View style={pdf.section}>
            <Text style={pdf.sectionTitle}>Objet de la mission</Text>
            <Text style={pdf.bodyText}>{mission.objetMission}</Text>
          </View>
        )}

        {mission?.pointsControle && mission.pointsControle.length > 0 && (
          <View style={pdf.section}>
            <Text style={pdf.sectionTitle}>Éléments contrôlés</Text>
            <Text style={pdf.bodyText}>{mission.pointsControle.join(' · ')}</Text>
          </View>
        )}

        {mission?.methodologie && (
          <View style={pdf.section}>
            <Text style={pdf.sectionTitle}>Méthodologie d'intervention</Text>
            <Text style={pdf.bodyText}>{mission.methodologie}</Text>
          </View>
        )}

        <PageFooter />
      </Page>

      {/* Pages 3+ — Contenu principal : ortho OU plan de situation + photos terrain */}
      {isSansOrtho ? (
        <>
          {/* Pages 3+ sans-ortho — Photos terrain annotées */}
          {(draft.photos ?? []).filter((p) => p.status === 'done').map((photo, photoIdx) => {
            const photoAnnotations = photo.annotations ?? []
            const sevCount = { faible: 0, modere: 0, grave: 0, critique: 0 }
            for (const a of photoAnnotations) {
              if (a.severity in sevCount) sevCount[a.severity as keyof typeof sevCount]++
            }
            return (
              <Page key={photo.id} size="A4" style={pdf.page}>
                <ReportHeader draft={draft} fixed />
                <Text style={pdf.terrainPhotoTitle}>
                  Photo {photoIdx + 1}{photo.name ? ` — ${photo.name}` : ''}{photo.meta?.prisLe ? ` — ${photo.meta.prisLe.slice(11, 16)}` : ''}
                </Text>
                <View style={pdf.severityGrid}>
                  {([ ['faible', 'Faible'], ['modere', 'Modéré'], ['grave', 'Grave'], ['critique', 'Critique'] ] as const).map(
                    ([key, label]) => (
                      <View key={key} style={{ ...pdf.severityBox, backgroundColor: SEVERITY_HEX[key] }}>
                        <Text style={pdf.severityBoxCount}>{sevCount[key]}</Text>
                        <Text style={pdf.severityBoxLabel}>{label}</Text>
                      </View>
                    )
                  )}
                </View>
                {photoDataUrls.has(`terrain-${photo.id}`) ? (
                  <View style={pdf.terrainPhotoWrap}>
                    <Image src={photoDataUrls.get(`terrain-${photo.id}`)!} style={pdf.terrainPhotoImg} />
                    <OrthoOverlay annotations={photoAnnotations} isPV={false} />
                  </View>
                ) : (
                  <Text style={pdf.noContent}>Photo indisponible</Text>
                )}
                {photoAnnotations.length > 0 && (
                  <>
                    <Text style={pdf.sectionTitle}>Anomalies</Text>
                    <View style={pdf.indexGrid}>
                      {photoAnnotations.map((ann, i) => (
                        <IndexCard key={ann.id} num={i + 1} ann={ann} />
                      ))}
                    </View>
                  </>
                )}
                <PageFooter />
              </Page>
            )
          })}
        </>
      ) : (
        <>
          {/* Page 3 avec ortho — Ortho annotée (flow existant inchangé) */}
          <Page size="A4" style={pdf.page}>
            <ReportHeader draft={draft} fixed />

            {/* Sévérité non affichée pour le PV : le figuré + couleur la remplacent */}
            {!isPV && (
              <View style={pdf.severityGrid}>
                {([ ['faible', 'Faible'], ['modere', 'Modéré'], ['grave', 'Grave'], ['critique', 'Critique'] ] as const).map(
                  ([key, label]) => (
                    <View key={key} style={{ ...pdf.severityBox, backgroundColor: SEVERITY_HEX[key] }}>
                      <Text style={pdf.severityBoxCount}>{sevCount[key]}</Text>
                      <Text style={pdf.severityBoxLabel}>{label}</Text>
                    </View>
                  )
                )}
              </View>
            )}

            <Text style={pdf.sectionTitle}>Ortho annotée</Text>
            {isPV && <PvShapeLegend />}
            {photoDataUrls.has('cover') ? (
              <View style={pdf.orthoWrap}>
                <Image src={photoDataUrls.get('cover')!} style={pdf.orthoImg} />
                <OrthoOverlay annotations={annotations} isPV={isPV} />
              </View>
            ) : (
              <Text style={pdf.noContent}>Ortho indisponible</Text>
            )}

            <PageFooter />
          </Page>

          {/* Page 4 — Index des anomalies (Toiture uniquement : la forme + couleur sur
              l'ortho remplacent l'index pour le PV, qui n'a jamais de photo jointe ici). */}
          {!isPV && (
            <Page size="A4" style={pdf.page}>
              <ReportHeader draft={draft} fixed />

              <Text style={pdf.sectionTitle}>Index des anomalies</Text>
              {annotations.length === 0 ? (
                <Text style={pdf.noContent}>Aucune anomalie renseignée</Text>
              ) : (
                <View style={pdf.indexGrid}>
                  {annotations.map((ann, i) => (
                    <IndexCard key={ann.id} num={i + 1} ann={ann} photoUrl={photoDataUrls.get(`ann-${ann.id}`)} />
                  ))}
                </View>
              )}

              <PageFooter />
            </Page>
          )}
        </>
      )}

      {/* Dernière page — Conclusion & limites de la mission */}
      <Page size="A4" style={pdf.page}>
        <ReportHeader draft={draft} fixed />

        {draft.conclusion && draft.conclusion.trim() && (
          <View style={pdf.section}>
            <Text style={pdf.sectionTitle}>Conclusion</Text>
            <Text style={pdf.bodyText}>{draft.conclusion}</Text>
          </View>
        )}

        <View style={pdf.section}>
          <Text style={pdf.sectionTitle}>Limites de la mission</Text>
          <Text style={pdf.bodyText}>{draft.missionLimitations || getDefaultMissionLimitations(mission?.typeInspection)}</Text>
        </View>

        <PageFooter />
      </Page>
    </Document>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={pdf.row}>
      <Text style={pdf.label}>{label}</Text>
      <Text style={pdf.value}>{value}</Text>
    </View>
  )
}
