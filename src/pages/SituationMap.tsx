import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import type { Map as LMap, LatLngBounds, Point } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { useDraft } from '../hooks/useDraft'
import { saveDraft, loadDraft, updateDraftIgnPlan, updateDraftPhotos, updateDraftPlanBatiment } from '../lib/reportDraft'
import { blobToDataUrl } from '../lib/imageUtils'
import {
  photosDuPdf, reperesPhotos, dansEmprise, versPixel, versReperesPlan,
  type Emprise, type LatLon, type Repere,
} from '../lib/reperesPhotos'

// Fix Leaflet marker icons cassés par le bundling Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const DEFAULT_CENTER: [number, number] = [46.6, 2.5]
const DEFAULT_ZOOM = 6
const GEOCODE_ZOOM = 18

const IGN_WMTS = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM' +
  '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg'

// Composant interne pour accéder à l'instance map Leaflet
function MapHandle({ mapRef, onReady }: { mapRef: React.MutableRefObject<LMap | null>; onReady: () => void }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
    onReady()
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// Composant interne : clic sur la carte → placement (bâtiment ou photo en attente)
function ClickToPlace({ onPlace }: { onPlace: (pos: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPlace([e.latlng.lat, e.latlng.lng]) })
  return null
}

/** Convertit une emprise Leaflet en emprise simple (pour les fonctions pures). */
function versEmprise(b: LatLngBounds): Emprise {
  return { nord: b.getNorth(), sud: b.getSouth(), est: b.getEast(), ouest: b.getWest() }
}

// Composant interne : remonte l'emprise affichée à chaque déplacement / zoom,
// pour savoir si des repères sortent du cadre qui sera capturé.
// Écouteur posé une seule fois (pas useMapEvents) : avec un objet de handlers recréé
// à chaque rendu, React le retire puis le remet, et le setView du géocodage,
// joué entre les deux, passait inaperçu.
function SuiviEmprise({ onChange }: { onChange: (e: Emprise) => void }) {
  const map = useMap()
  useEffect(() => {
    const maj = () => onChange(versEmprise(map.getBounds()))
    maj()
    map.on('moveend', maj)
    return () => { map.off('moveend', maj) }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps -- onChange = setState, stable
  return null
}

/**
 * Icône d'un repère photo sur la carte : pastille numérotée.
 * - pleine marine : position corrigée par l'utilisateur ;
 * - blanche à bord pointillé : GPS du drone, pas encore vérifié (position approximative).
 */
function iconeRepere(numero: number, corrige: boolean): L.DivIcon {
  const style = corrige
    ? 'background:#1a2e44;color:#fff;border:2px solid #fff;'
    : 'background:#fff;color:#1a2e44;border:2px dashed #1a2e44;'
  return L.divIcon({
    className: '', // pas la classe par défaut de Leaflet (carré blanc)
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="${style}width:28px;height:28px;box-sizing:border-box;border-radius:50%;` +
      `display:flex;align-items:center;justify-content:center;font:600 13px 'Geist Mono',ui-monospace,monospace;` +
      `box-shadow:0 1px 3px rgba(15,26,37,.35);cursor:grab">${numero}</div>`,
  })
}

function SetView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => { map.setView(center, zoom) }, [center, zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

async function geocodeBAN(adresse: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`)
    const json = await res.json()
    const coords = json.features?.[0]?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return null
    return [coords[1] as number, coords[0] as number] // [lat, lng]
  } catch {
    return null
  }
}

async function captureWMS(bounds: LatLngBounds, size: Point): Promise<Blob> {
  const south = bounds.getSouth()
  const west = bounds.getWest()
  const north = bounds.getNorth()
  const east = bounds.getEast()
  const w = Math.round(size.x)
  const h = Math.round(size.y)
  const url = 'https://data.geopf.fr/wms-r/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
    '&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS&STYLES=&FORMAT=image/jpeg' +
    `&CRS=EPSG:4326&BBOX=${south},${west},${north},${east}` +
    `&WIDTH=${w}&HEIGHT=${h}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`WMS ${res.status}`)
  return res.blob()
}

/**
 * Dessine sur l'image WMS le point rouge du bâtiment et les repères numérotés des photos.
 * Seuls les repères dans l'emprise sont dessinés (les autres tomberaient hors de l'image).
 * Le bâtiment est dessiné d'abord : les numéros restent lisibles s'ils le chevauchent.
 */
async function dessinerReperes(
  blob: Blob,
  bounds: LatLngBounds,
  batiment: [number, number] | null,
  reperes: Repere[],
): Promise<string> {
  const img = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  img.close()

  const emprise = versEmprise(bounds)
  const base = Math.min(canvas.width, canvas.height)

  // Point du bâtiment (inchangé : rond rouge cerclé de blanc)
  if (batiment) {
    const { x, y } = versPixel({ lat: batiment[0], lon: batiment[1] }, emprise, canvas.width, canvas.height)
    const R = Math.round(base * 0.015)
    ctx.beginPath()
    ctx.arc(x, y, R, 0, Math.PI * 2)
    ctx.fillStyle = '#b91c1c'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, R * 0.2)
    ctx.stroke()
  }

  // Repères photos : pastille marine, liseré blanc, numéro blanc centré
  const R = Math.max(10, Math.round(base * 0.022))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${Math.round(R * 1.1)}px sans-serif`
  for (const r of reperes) {
    const { x, y } = versPixel(r.pos, emprise, canvas.width, canvas.height)
    ctx.beginPath()
    ctx.arc(x, y, R, 0, Math.PI * 2)
    ctx.fillStyle = '#1a2e44'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, R * 0.18)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(r.numero), x, y + 1)
  }

  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
  return blobToDataUrl(out)
}

export default function SituationMap() {
  const navigate = useNavigate()
  const { draft, setDraft } = useDraft()
  const mapRef = useRef<LMap | null>(null)
  // Position du bâtiment déjà enregistrée (retour sur le plan) : on repart d'elle, pas de l'adresse
  const batimentEnregistre: [number, number] | null = draft?.planBatiment
    ? [draft.planBatiment.lat, draft.planBatiment.lon]
    : null
  const [center, setCenter] = useState<[number, number]>(batimentEnregistre ?? DEFAULT_CENTER)
  const [zoom, setZoom] = useState(batimentEnregistre ? GEOCODE_ZOOM : DEFAULT_ZOOM)
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(batimentEnregistre)
  const [geocodeFailed, setGeocodeFailed] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState(false)
  // Photo en attente de placement manuel : le prochain clic sur la carte la place
  const [aPlacer, setAPlacer] = useState<string | null>(null)
  // Emprise affichée (= ce qui sera capturé)
  const [emprise, setEmprise] = useState<Emprise | null>(null)

  // Photos qui auront une page dans le PDF, et leurs repères (numéro = « Photo N » du PDF)
  const photos = useMemo(() => photosDuPdf(draft?.photos), [draft?.photos])
  const reperes = useMemo(() => reperesPhotos(draft?.photos), [draft?.photos])

  // Repères (bâtiment compris) qui sortent du cadre : ils manqueraient sur le plan capturé
  const horsCadre = emprise
    ? reperes.filter((r) => !dansEmprise(r.pos, emprise)).length +
      (markerPos && !dansEmprise({ lat: markerPos[0], lon: markerPos[1] }, emprise) ? 1 : 0)
    : 0

  useEffect(() => {
    // Bâtiment déjà placé lors d'un passage précédent : ne pas le remplacer par l'adresse géocodée
    if (draft?.planBatiment) return
    const adresse = draft?.mission?.adresse
    if (!adresse) {
      setGeocodeFailed(true)
      return
    }
    geocodeBAN(adresse).then((pos) => {
      if (pos) {
        setCenter(pos)
        setMarkerPos(pos)
        setZoom(GEOCODE_ZOOM)
      } else {
        setGeocodeFailed(true)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mode placement : curseur en croix sur la carte, Échap pour annuler
  useEffect(() => {
    const conteneur = mapRef.current?.getContainer()
    if (conteneur) conteneur.style.cursor = aPlacer ? 'crosshair' : ''
    if (!aPlacer) return
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') setAPlacer(null) }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [aPlacer])

  /**
   * Enregistre (ou efface, si `pos` est undefined) la position corrigée d'une photo.
   * Relit le brouillon dans le cache pour ne pas écraser une modification récente.
   * meta.gps n'est jamais modifié.
   */
  function majPosition(id: string, pos: LatLon | undefined) {
    if (!draft) return
    const d = loadDraft(draft.sessionUuid) ?? draft
    const maj = (d.photos ?? []).map((p) => {
      if (p.id !== id) return p
      const { position: _ancienne, ...reste } = p
      void _ancienne
      return pos ? { ...reste, position: pos } : reste
    })
    const next = updateDraftPhotos(d, maj)
    saveDraft(next)
    setDraft(next)
  }

  /**
   * Déplace le marqueur du bâtiment et l'enregistre dans le brouillon (planBatiment),
   * pour le retrouver au prochain passage sur le plan (ex. pour localiser les photos).
   */
  function majBatiment(pos: [number, number]) {
    setMarkerPos(pos)
    if (!draft) return
    const d = loadDraft(draft.sessionUuid) ?? draft
    const next = updateDraftPlanBatiment(d, { lat: pos[0], lon: pos[1] })
    saveDraft(next)
    setDraft(next)
  }

  /** Clic sur la carte : place la photo en attente, sinon déplace le marqueur du bâtiment. */
  function surClicCarte(pos: [number, number]) {
    if (aPlacer) {
      majPosition(aPlacer, { lat: pos[0], lon: pos[1] })
      setAPlacer(null)
    } else {
      majBatiment(pos)
    }
  }

  /** Recadre la carte pour voir le bâtiment et tous les repères photos. */
  function ajusterVue() {
    const map = mapRef.current
    if (!map) return
    const points: [number, number][] = reperes.map((r) => [r.pos.lat, r.pos.lon])
    if (markerPos) points.push(markerPos)
    if (!points.length) return
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 19 })
  }

  async function capture() {
    const map = mapRef.current
    if (!map || !draft) return
    setCapturing(true)
    setCaptureError(false)
    try {
      const bounds = map.getBounds()
      const size = map.getSize()
      const blob = await captureWMS(bounds, size)
      // Seuls les repères dans le cadre sont dessinés ; on garde leur liste pour le PDF
      const empriseCapturee = versEmprise(bounds)
      const visibles = reperes.filter((r) => dansEmprise(r.pos, empriseCapturee))
      const dataUrl = markerPos || visibles.length
        ? await dessinerReperes(blob, bounds, markerPos, visibles)
        : await blobToDataUrl(blob)
      // Relire le brouillon : les positions ont pu changer depuis le dernier rendu
      const d = loadDraft(draft.sessionUuid) ?? draft
      // Le bâtiment est aussi enregistré à la capture (cas d'une position géocodée jamais déplacée)
      const avecBatiment = markerPos ? updateDraftPlanBatiment(d, { lat: markerPos[0], lon: markerPos[1] }) : d
      const next = updateDraftIgnPlan(avecBatiment, dataUrl, versReperesPlan(visibles), empriseCapturee)
      saveDraft(next)
      setDraft(next)
      navigate('/photos-terrain')
    } catch {
      setCaptureError(true)
    } finally {
      setCapturing(false)
    }
  }

  return (
    <main style={{ ...s.main, ...(photos.length ? s.mainLarge : {}) }}>
      <h1 style={s.title}>Plan de situation</h1>

      {geocodeFailed && (
        <p style={s.warning}>Adresse non trouvée — naviguez manuellement jusqu'au bâtiment</p>
      )}
      {captureError && (
        <p style={s.error}>Capture échouée — vérifiez votre connexion et réessayez</p>
      )}
      {horsCadre > 0 && (
        <div style={s.warning}>
          {horsCadre} repère{horsCadre > 1 ? 's' : ''} hors du cadre : absent{horsCadre > 1 ? 's' : ''} du plan capturé.{' '}
          <button onClick={ajusterVue} style={s.lienBtn}>Ajuster la vue</button>
        </div>
      )}

      <div style={s.layout}>
        <div style={{ ...s.mapWrap, ...(aPlacer ? s.mapWrapPlacement : {}) }}>
          <MapContainer center={center} zoom={zoom} style={s.map}>
            <TileLayer url={IGN_WMTS} attribution="© IGN Géoportail" maxZoom={21} maxNativeZoom={19} />
            {markerPos && (
              <Marker
                position={markerPos}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng()
                    majBatiment([lat, lng])
                  },
                }}
              />
            )}
            {/* Repères photos : déplaçables, le déplacement enregistre `position` */}
            {reperes.map((r) => {
              const photo = photos.find((p) => p.id === r.id)
              return (
                <Marker
                  key={r.id}
                  position={[r.pos.lat, r.pos.lon]}
                  icon={iconeRepere(r.numero, !!photo?.position)}
                  title={`Photo ${r.numero}${photo?.name ? ` — ${photo.name}` : ''}`}
                  draggable
                  zIndexOffset={1000}
                  eventHandlers={{
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng()
                      majPosition(r.id, { lat, lon: lng })
                    },
                  }}
                />
              )
            })}
            <ClickToPlace onPlace={surClicCarte} />
            <SetView center={center} zoom={zoom} />
            <SuiviEmprise onChange={setEmprise} />
            <MapHandle mapRef={mapRef} onReady={() => {}} />
          </MapContainer>
        </div>

        {photos.length > 0 && (
          <aside style={s.panneau} aria-label="Photos terrain">
            <h2 style={s.panneauTitre}>Photos ({photos.length})</h2>
            <p style={s.panneauAide}>
              Le GPS est celui du drone, pas du point photographié : glissez chaque repère sur ce que montre la photo.
            </p>
            <div style={s.legende}>
              <span style={s.legendeItem}><span style={{ ...s.pastille, ...s.pastilleCorrigee }} /> corrigé</span>
              <span style={s.legendeItem}><span style={{ ...s.pastille, ...s.pastilleGps }} /> GPS drone</span>
            </div>
            <ul style={s.liste}>
              {photos.map((p, i) => {
                const numero = i + 1
                const enAttente = aPlacer === p.id
                const etat = p.position ? 'Position corrigée' : p.meta?.gps ? 'GPS du drone' : 'Sans GPS'
                return (
                  <li key={p.id} style={{ ...s.ligne, ...(enAttente ? s.ligneActive : {}) }}>
                    <span style={{ ...s.numero, ...(p.position ? s.pastilleCorrigee : p.meta?.gps ? s.pastilleGps : s.numeroVide) }}>
                      {numero}
                    </span>
                    {p.storageUrl && <img src={p.storageUrl} alt="" style={s.vignette} />}
                    <span style={s.ligneTexte}>
                      <span style={s.ligneNom}>{p.name ?? `Photo ${numero}`}</span>
                      <span style={{ ...s.ligneEtat, ...(etat === 'Sans GPS' ? s.ligneEtatAlerte : {}) }}>
                        {enAttente ? 'Cliquez sur la carte…' : etat}
                      </span>
                    </span>
                    {/* Sans position : placement à la main par clic sur la carte */}
                    {!p.position && !p.meta?.gps && (
                      <button onClick={() => setAPlacer(enAttente ? null : p.id)} style={s.petitBtn}>
                        {enAttente ? 'Annuler' : 'Placer'}
                      </button>
                    )}
                    {/* Position corrigée : revenir au GPS du drone, ou retirer le placement manuel */}
                    {p.position && (
                      <button
                        onClick={() => majPosition(p.id, undefined)}
                        style={s.petitBtn}
                        title={p.meta?.gps ? 'Revenir à la position GPS du drone' : 'Retirer le repère du plan'}
                      >
                        {p.meta?.gps ? '↺ GPS' : 'Retirer'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </aside>
        )}
      </div>

      <p style={s.hint}>
        {aPlacer
          ? 'Cliquez sur la carte à l\'endroit photographié · Échap pour annuler'
          : 'Cliquez sur la carte pour placer le marqueur · Zoomez sur le bâtiment · Glissez le marqueur pour l\'ajuster'}
        {photos.length > 0 && ' · Recapturez le plan après avoir déplacé des repères'}
      </p>

      <button onClick={capture} disabled={capturing} data-tour="capturer-plan" style={{ ...s.cta, ...(capturing ? s.ctaOff : {}) }}>
        {capturing ? 'Capture en cours…' : 'Capturer ce plan de situation →'}
      </button>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { padding: '48px 40px', maxWidth: 900, margin: '0 auto' },
  mainLarge: { maxWidth: 1200 }, // place pour la liste des photos à droite de la carte
  title: { fontSize: 26, fontWeight: 700, marginBottom: 16, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.01em' },
  warning: { background: '#fef3e2', border: '1px solid #e5b87a', borderRadius: 8, padding: '10px 14px', color: '#92570a', fontSize: 14, marginBottom: 16 },
  error: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 14, marginBottom: 16 },
  layout: { display: 'flex', gap: 16, alignItems: 'stretch', marginBottom: 12 },
  mapWrap: { flex: 1, minWidth: 0, borderRadius: 10, overflow: 'hidden', border: '1.5px solid #dde1e6' },
  mapWrapPlacement: { borderColor: '#c07828', boxShadow: '0 0 0 3px #fef3e2' }, // mode placement : cadre ambre
  lienBtn: { background: 'none', border: 'none', padding: 0, color: '#1a2e44', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' },
  // Panneau des photos (à droite de la carte)
  panneau: { width: 280, flexShrink: 0, height: 500, display: 'flex', flexDirection: 'column', border: '1.5px solid #dde1e6', borderRadius: 10, background: '#fff', padding: 12, boxSizing: 'border-box' },
  panneauTitre: { fontSize: 16, fontWeight: 600, margin: '0 0 4px', fontFamily: "'Instrument Sans', sans-serif" },
  panneauAide: { fontSize: 12, color: '#5a7083', margin: '0 0 8px', lineHeight: 1.4 },
  legende: { display: 'flex', gap: 12, fontSize: 11, color: '#5a7083', marginBottom: 8 },
  legendeItem: { display: 'flex', alignItems: 'center', gap: 4 },
  pastille: { display: 'inline-block', width: 12, height: 12, borderRadius: '50%', boxSizing: 'border-box' },
  pastilleCorrigee: { background: '#1a2e44', color: '#fff', border: '2px solid #1a2e44' },
  pastilleGps: { background: '#fff', color: '#1a2e44', border: '2px dashed #1a2e44' },
  liste: { listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 },
  ligne: { display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 6, border: '1px solid #dde1e6', minHeight: 44, boxSizing: 'border-box' },
  ligneActive: { borderColor: '#c07828', background: '#fef3e2' },
  numero: { width: 24, height: 24, flexShrink: 0, borderRadius: '50%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, fontFamily: "'Geist Mono', ui-monospace, monospace" },
  numeroVide: { background: '#f1f4f7', color: '#5a7083', border: '1px solid #dde1e6' },
  vignette: { width: 40, height: 30, objectFit: 'cover', borderRadius: 4, flexShrink: 0 },
  ligneTexte: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  ligneNom: { fontSize: 12, fontWeight: 600, color: '#0f1a25', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ligneEtat: { fontSize: 11, color: '#5a7083' },
  ligneEtatAlerte: { color: '#92570a' },
  petitBtn: { background: '#fff', border: '1.5px solid #c9d3dc', borderRadius: 6, color: '#1a2e44', padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', minHeight: 32, flexShrink: 0 },
  map: { height: 500, width: '100%' },
  hint: { fontSize: 13, color: '#9ca3af', margin: '0 0 24px' },
  cta: { width: '100%', background: '#1a2e44', color: '#fff', padding: '16px 24px', borderRadius: 10, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: 52, fontFamily: 'inherit' },
  ctaOff: { background: '#d1d5db', cursor: 'not-allowed' },
}
