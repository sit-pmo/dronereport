import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import type { Map as LMap, LatLngBounds, Point } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { useDraft } from '../hooks/useDraft'
import { saveDraft, updateDraftIgnPlan } from '../lib/reportDraft'
import { blobToDataUrl } from '../lib/imageUtils'

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

// Composant interne pour centrer la map après géocodage sans remount
function ClickToPlace({ onPlace }: { onPlace: (pos: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPlace([e.latlng.lat, e.latlng.lng]) })
  return null
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

async function drawMarker(
  blob: Blob,
  markerPos: [number, number],
  bounds: LatLngBounds,
): Promise<string> {
  const img = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  img.close()

  const latFrac = (bounds.getNorth() - markerPos[0]) / (bounds.getNorth() - bounds.getSouth())
  const lngFrac = (markerPos[1] - bounds.getWest()) / (bounds.getEast() - bounds.getWest())
  const cx = Math.round(lngFrac * canvas.width)
  const cy = Math.round(latFrac * canvas.height)
  const R = Math.round(Math.min(canvas.width, canvas.height) * 0.015)

  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = '#b91c1c'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(2, R * 0.2)
  ctx.stroke()

  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
  return blobToDataUrl(out)
}

export default function SituationMap() {
  const navigate = useNavigate()
  const { draft, setDraft } = useDraft()
  const mapRef = useRef<LMap | null>(null)
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null)
  const [geocodeFailed, setGeocodeFailed] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState(false)

  useEffect(() => {
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

  async function capture() {
    const map = mapRef.current
    if (!map || !draft) return
    setCapturing(true)
    setCaptureError(false)
    try {
      const bounds = map.getBounds()
      const size = map.getSize()
      const blob = await captureWMS(bounds, size)
      const dataUrl = markerPos
        ? await drawMarker(blob, markerPos, bounds)
        : await blobToDataUrl(blob)
      const next = updateDraftIgnPlan(draft, dataUrl)
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
    <main style={s.main}>
      <h1 style={s.title}>Plan de situation</h1>

      {geocodeFailed && (
        <p style={s.warning}>Adresse non trouvée — naviguez manuellement jusqu'au bâtiment</p>
      )}
      {captureError && (
        <p style={s.error}>Capture échouée — vérifiez votre connexion et réessayez</p>
      )}

      <div style={s.mapWrap}>
        <MapContainer center={center} zoom={zoom} style={s.map}>
          <TileLayer url={IGN_WMTS} attribution="© IGN Géoportail" maxZoom={21} maxNativeZoom={19} />
          {markerPos && (
            <Marker
              position={markerPos}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng()
                  setMarkerPos([lat, lng])
                },
              }}
            />
          )}
          <ClickToPlace onPlace={setMarkerPos} />
          <SetView center={center} zoom={zoom} />
          <MapHandle mapRef={mapRef} onReady={() => {}} />
        </MapContainer>
      </div>

      <p style={s.hint}>
        Cliquez sur la carte pour placer le marqueur · Zoomez sur le bâtiment · Glissez le marqueur pour l'ajuster
      </p>

      <button onClick={capture} disabled={capturing} style={{ ...s.cta, ...(capturing ? s.ctaOff : {}) }}>
        {capturing ? 'Capture en cours…' : 'Capturer ce plan de situation →'}
      </button>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { padding: '48px 40px', maxWidth: 900, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 16, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.01em' },
  warning: { background: '#fef3e2', border: '1px solid #e5b87a', borderRadius: 8, padding: '10px 14px', color: '#92570a', fontSize: 14, marginBottom: 16 },
  error: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 14, marginBottom: 16 },
  mapWrap: { borderRadius: 10, overflow: 'hidden', border: '1.5px solid #dde1e6', marginBottom: 12 },
  map: { height: 500, width: '100%' },
  hint: { fontSize: 13, color: '#9ca3af', margin: '0 0 24px' },
  cta: { width: '100%', background: '#1a2e44', color: '#fff', padding: '16px 24px', borderRadius: 10, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: 52, fontFamily: 'inherit' },
  ctaOff: { background: '#d1d5db', cursor: 'not-allowed' },
}
