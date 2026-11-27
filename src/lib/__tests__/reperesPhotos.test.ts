/**
 * Tests des repères photos sur le plan de situation (parcours sans ortho).
 */
import { describe, it, expect } from 'vitest'
import {
  numerosPhotos, positionPhoto, reperesPhotos, dansEmprise, versPixel,
  versReperesPlan, numeroSurLePlan, planPerime, type Emprise,
} from '../reperesPhotos'
import type { PhotoItem, ReportDraft } from '../../types'

/** Photo terrain minimale ; `gps` = GPS du drone (EXIF), `position` = position corrigée. */
function photo(id: string, opts: Partial<PhotoItem> & { gps?: { lat: number; lon: number } } = {}): PhotoItem {
  const { gps, ...reste } = opts
  return { id, status: 'done', meta: gps ? { gps } : {}, ...reste }
}

const EMPRISE: Emprise = { nord: 46, sud: 45, est: -1, ouest: -2 }

/** Brouillon sans ortho avec un plan capturé sur EMPRISE. */
function draft(photos: PhotoItem[], extra: Partial<ReportDraft> = {}): ReportDraft {
  return {
    sessionUuid: 's', createdAt: '2026-11-27T00:00:00Z', mission: null, ortho: null,
    ignPlanDataUrl: 'data:image/jpeg;base64,', photos, ignPlanEmprise: EMPRISE, ...extra,
  }
}

describe('numérotation', () => {
  it("suit l'ordre du PDF : photos terminées seulement, dans l'ordre du brouillon", () => {
    const n = numerosPhotos([photo('a'), photo('b', { status: 'failed' }), photo('c'), photo('d', { status: 'uploading' })])
    expect([...n.entries()]).toEqual([['a', 1], ['c', 2]])
  })
})

describe('positionPhoto', () => {
  it('préfère la position corrigée au GPS du drone, sans toucher meta.gps', () => {
    const p = photo('a', { gps: { lat: 45.5, lon: -1.5 }, position: { lat: 45.6, lon: -1.4 } })
    expect(positionPhoto(p)).toEqual({ lat: 45.6, lon: -1.4 })
    expect(p.meta?.gps).toEqual({ lat: 45.5, lon: -1.5 })
  })
  it('reprend le GPS du drone à défaut, rien sinon', () => {
    expect(positionPhoto(photo('a', { gps: { lat: 45.5, lon: -1.5 } }))).toEqual({ lat: 45.5, lon: -1.5 })
    expect(positionPhoto(photo('b'))).toBeUndefined()
  })
})

describe('reperesPhotos', () => {
  it('garde le numéro du PDF même si une photo précédente est sans position', () => {
    const r = reperesPhotos([photo('a'), photo('b', { gps: { lat: 45.5, lon: -1.5 } })])
    expect(r).toEqual([{ id: 'b', numero: 2, pos: { lat: 45.5, lon: -1.5 } }])
  })
})

describe('géométrie', () => {
  it('dansEmprise inclut les bords', () => {
    expect(dansEmprise({ lat: 46, lon: -2 }, EMPRISE)).toBe(true)
    expect(dansEmprise({ lat: 46.01, lon: -1.5 }, EMPRISE)).toBe(false)
  })
  it('versPixel : coin nord-ouest en (0,0), centre au milieu', () => {
    expect(versPixel({ lat: 46, lon: -2 }, EMPRISE, 800, 600)).toEqual({ x: 0, y: 0 })
    expect(versPixel({ lat: 45.5, lon: -1.5 }, EMPRISE, 800, 600)).toEqual({ x: 400, y: 300 })
    expect(versPixel({ lat: 45, lon: -1 }, EMPRISE, 800, 600)).toEqual({ x: 800, y: 600 })
  })
})

describe('plan capturé', () => {
  const gpsB = { lat: 45.5, lon: -1.5 }
  const photos = [photo('a'), photo('b', { gps: gpsB })]
  const capture = versReperesPlan(reperesPhotos(photos))

  it('à jour juste après la capture, renvoi « repère N » disponible', () => {
    const d = draft(photos, { ignPlanReperes: capture })
    expect(planPerime(d)).toBe(false)
    expect(numeroSurLePlan(d, 'b')).toBe(2)
    expect(numeroSurLePlan(d, 'a')).toBeUndefined()
  })

  it('périmé si un repère a été déplacé', () => {
    const d = draft([photo('a'), photo('b', { gps: gpsB, position: { lat: 45.4, lon: -1.5 } })], { ignPlanReperes: capture })
    expect(planPerime(d)).toBe(true)
  })

  it("périmé et sans renvoi si la numérotation a glissé (photo supprimée avant)", () => {
    const d = draft([photo('b', { gps: gpsB })], { ignPlanReperes: capture })
    expect(planPerime(d)).toBe(true)
    expect(numeroSurLePlan(d, 'b')).toBeUndefined() // le plan affiche 2, le PDF dirait Photo 1
  })

  it("périmé si une photo placée tombe dans l'emprise capturée, pas si elle est en dehors", () => {
    const dedans = draft([...photos, photo('c', { position: { lat: 45.2, lon: -1.2 } })], { ignPlanReperes: capture })
    const dehors = draft([...photos, photo('c', { position: { lat: 47, lon: -1.2 } })], { ignPlanReperes: capture })
    expect(planPerime(dedans)).toBe(true)
    expect(planPerime(dehors)).toBe(false)
  })

  it("pas d'alerte sans plan", () => {
    expect(planPerime(draft(photos, { ignPlanDataUrl: undefined }))).toBe(false)
  })
})
