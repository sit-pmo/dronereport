import type { PhotoAnnotation } from '../types'

function isTiffFile(file: File): boolean {
  return file.type === 'image/tiff' || /\.tiff?$/i.test(file.name)
}

// Décode un GeoTIFF (export standard des logiciels de photogrammétrie — Pix4D,
// Metashape, WebODM) en ImageBitmap. `createImageBitmap` ne sait pas lire le
// TIFF nativement dans aucun navigateur — d'où ce détour par geotiff.js.
// Chargée dynamiquement : la lib (+ pako pour le Deflate) ne pèse que sur les
// uploads de TIFF, pas sur le bundle principal.
// `readRGB()` (pas `readRasters()`) : seule l'API qui convertit YCbCr/CMYK/
// palette/niveaux de gris en RGB plat. Les orthomosaics drone compressées en
// JPEG-in-TIFF sont typiquement en YCbCr — les lire en composantes brutes via
// readRasters() et les traiter comme du RGB produit l'inversion magenta/cyan
// observée (Y/Cb/Cr mal interprétés comme R/G/B).
// ponytail: décode au format cible directement plutôt qu'en pleine résolution
// — évite l'OOM sur un orthomosaic de plusieurs centaines de Mo.
async function decodeTiffToBitmap(file: File, maxWidth: number): Promise<ImageBitmap> {
  const { fromArrayBuffer, Pool } = await import('geotiff')
  const tiff = await fromArrayBuffer(await file.arrayBuffer())
  const image = await tiff.getImage()

  const scale = Math.min(1, maxWidth / image.getWidth())
  const width = Math.max(1, Math.round(image.getWidth() * scale))
  const height = Math.max(1, Math.round(image.getHeight() * scale))

  // Sans pool, le décodage JPEG/Deflate tourne en synchrone sur le thread
  // principal — sur un gros orthomosaic ça gèle l'onglet plusieurs dizaines
  // de secondes (la barre de progression ne peut pas se repeindre tant que le
  // JS bloque). Le Pool décharge le décodage sur des Web Workers.
  const pool = new Pool()
  let rgb: ArrayLike<number>
  try {
    rgb = await image.readRGB({ width, height, interleave: true, pool })
  } finally {
    pool.destroy()
  }

  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0, p = 0; p < rgba.length; i += 3, p += 4) {
    rgba[p] = rgb[i]
    rgba[p + 1] = rgb[i + 1]
    rgba[p + 2] = rgb[i + 2]
    rgba[p + 3] = 255
  }

  return createImageBitmap(new ImageData(rgba, width, height))
}

// Downscale an image file client-side before PDF injection and Supabase upload.
// Uses createImageBitmap + OffscreenCanvas to avoid DOM layout cost and prevent
// Android OOM with 10×5MB originals (E-CRIT-3 from eng review).
//
// Strategy: resize to maxWidth keeping aspect ratio, then re-encode as JPEG
// at decreasing quality until the blob fits under maxBytes.

export async function downscaleImage(
  file: File,
  maxWidth: number,
  maxBytes: number,
): Promise<Blob> {
  const bitmap = isTiffFile(file)
    ? await decodeTiffToBitmap(file, maxWidth)
    : await createImageBitmap(file)

  const scale = Math.min(1, maxWidth / bitmap.width)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  // Try decreasing quality until under maxBytes
  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    if (blob.size <= maxBytes) return blob
  }

  // Last resort — minimum quality
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.35 })
}

// Bake numbered annotation markers onto a photo data URL for PDF rendering.
// Draws rectangles and numbered circles onto a copy of the image via OffscreenCanvas.
export async function flattenAnnotations(
  dataUrl: string,
  annotations: PhotoAnnotation[],
): Promise<string> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const img = await createImageBitmap(blob)
  const W = img.width
  const H = img.height

  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  img.close()

  const R = Math.round(Math.min(W, H) * 0.028)
  const strokeW = Math.max(2, Math.round(W * 0.003))

  annotations.forEach((ann, i) => {
    const num = i + 1
    const cx = Math.round(ann.x * W)
    const cy = Math.round(ann.y * H)

    if (ann.type === 'rect' && ann.w && ann.h) {
      const rx = Math.round(ann.x * W)
      const ry = Math.round(ann.y * H)
      const rw = Math.round(ann.w * W)
      const rh = Math.round(ann.h * H)
      ctx.fillStyle = 'rgba(239,68,68,0.18)'
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = strokeW
      ctx.strokeRect(rx, ry, rw, rh)
    }

    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = Math.max(1.5, strokeW * 0.7)
    ctx.stroke()

    ctx.fillStyle = 'white'
    ctx.font = `bold ${Math.round(R * 1.1)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), cx, cy)
  })

  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
  return blobToDataUrl(outBlob)
}

// Downscale a logo image to fit within 300×150px, preserving aspect ratio.
// PNG format is preserved (for transparency); other formats are converted to JPEG.
export async function downscaleLogo(file: File): Promise<Blob> {
  const MAX_W = 300
  const MAX_H = 150

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const isPng = file.type === 'image/png'
  return canvas.convertToBlob({ type: isPng ? 'image/png' : 'image/jpeg', quality: 0.9 })
}

// Read a Blob as a base64 data URL (for react-pdf image injection)
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Extrait la résolution sol (mètres/pixel) d'un GeoTIFF géoréférencé.
 * Retourne null si le fichier n'est pas un TIFF, n'est pas géoréférencé,
 * ou si l'extraction échoue.
 * Le GSD retourné est ajusté pour l'image stockée (post-downscale à 4000px max).
 */
export async function extractGsd(
  file: File,
): Promise<{ x: number; y: number } | null> {
  if (!isTiffFile(file)) return null
  try {
    const { fromArrayBuffer } = await import('geotiff')
    const tiff = await fromArrayBuffer(await file.arrayBuffer())
    const image = await tiff.getImage()
    const res = image.getResolution()
    if (!res || res[0] === 0) return null

    const keys = image.getGeoKeys()
    // GTModelTypeGeoKey : 1 = projeté (mètres), 2 = géographique (degrés WGS84)
    const isGeographic = keys?.GTModelTypeGeoKey === 2

    // Même downscale que decodeTiffToBitmap — le GSD de l'image stockée est
    // le GSD original divisé par le ratio de compression.
    const scale = Math.min(1, 4000 / image.getWidth())
    if (isGeographic) {
      const bbox = image.getBoundingBox()  // [west, south, east, north] in degrees
      const latMidRad = ((bbox[1] + bbox[3]) / 2) * (Math.PI / 180)
      return {
        x: Math.abs(res[0]) * 111_139 * Math.cos(latMidRad) / scale,
        y: Math.abs(res[1]) * 111_139 / scale,
      }
    }
    return { x: Math.abs(res[0]) / scale, y: Math.abs(res[1]) / scale }
  } catch {
    return null
  }
}
