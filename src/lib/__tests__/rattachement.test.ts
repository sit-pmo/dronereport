/**
 * Tests du rattachement notes terrain → photos drone.
 * Les heures sont construites en heure locale pour reproduire l'EXIF (sans fuseau).
 */
import { describe, it, expect } from 'vitest'
import { proposerRattachements, estimerDecalage, distanceM } from '../rattachement'
import type { NoteTerrain, PhotoItem } from '../../types'

/** Note prise à HH:mm:ss (heure locale) le 14/08/2026. */
function note(id: string, hms: string, gps?: { lat: number; lon: number }): NoteTerrain {
  return { id, prisLe: new Date(`2026-08-14T${hms}`).toISOString(), texte: id, gps }
}
/** Photo drone prise à HH:mm:ss (heure murale EXIF). */
function photo(id: string, hms: string, gps?: { lat: number; lon: number }): PhotoItem {
  return { id, status: 'done', meta: { prisLe: `2026-08-14T${hms}`, gps } }
}

describe('proposerRattachements', () => {
  const photos = [photo('p1', '10:00:00'), photo('p2', '10:02:00'), photo('p3', '10:10:00')]

  it('rattache chaque note à la photo la plus proche dans le temps', () => {
    const r = proposerRattachements([note('a', '10:00:20'), note('b', '10:09:00')], photos)
    expect(r.map((x) => x.photoId)).toEqual(['p1', 'p3'])
    expect(r[0].ecartS).toBe(20)
  })

  it('laisse une note sans photo au-delà de la tolérance', () => {
    const r = proposerRattachements([note('a', '11:00:00')], photos, 0, 300)
    expect(r[0].photoId).toBeUndefined()
  })

  it('applique le décalage d’horloge du drone', () => {
    // Drone en retard de 2 min : la photo « 10:00 » a en réalité été prise à 10:02
    const r = proposerRattachements([note('a', '10:02:05')], [photo('p1', '10:00:00'), photo('p9', '10:05:00')], 120)
    expect(r[0].photoId).toBe('p1')
  })

  it('départage deux photos quasi simultanées par le GPS', () => {
    const ici = { lat: 45.95, lon: -1.3 }
    const loin = { lat: 45.96, lon: -1.3 } // ≈ 1,1 km
    const r = proposerRattachements(
      [note('a', '10:00:05', ici)],
      [photo('loin', '10:00:04', loin), photo('pres', '10:00:09', ici)],
    )
    expect(r[0].photoId).toBe('pres')
  })

  it('ignore les photos sans heure', () => {
    const r = proposerRattachements([note('a', '10:00:00')], [{ id: 'x', status: 'done' }])
    expect(r[0].photoId).toBeUndefined()
  })
})

describe('estimerDecalage', () => {
  it('retrouve un décalage constant de +90 s', () => {
    const photos = [photo('p1', '10:00:00'), photo('p2', '10:05:00'), photo('p3', '10:10:00')]
    const notes = [note('a', '10:01:30'), note('b', '10:06:30'), note('c', '10:11:30')]
    expect(estimerDecalage(notes, photos)).toBe(90)
  })
})

describe('distanceM', () => {
  it('≈ 111 km pour un degré de latitude', () => {
    expect(Math.round(distanceM({ lat: 45, lon: 0 }, { lat: 46, lon: 0 }) / 1000)).toBe(111)
  })
})
