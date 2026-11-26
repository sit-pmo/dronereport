/**
 * Tests du pré-remplissage d'un rapport à partir d'un carnet de notes terrain.
 */
import { describe, it, expect } from 'vitest'
import { brouillonDepuisCarnet, dateMission, meilleurPointGps } from '../rapportDepuisCarnet'
import type { CarnetTerrain, NoteTerrain } from '../../types'

/** Note prise le 14/08/2026 à HH:mm (heure locale). */
function note(id: string, hm: string, gps?: NoteTerrain['gps']): NoteTerrain {
  return { id, prisLe: new Date(`2026-08-14T${hm}:00`).toISOString(), texte: id, gps }
}

function carnet(notes: NoteTerrain[]): CarnetTerrain {
  return { id: 'c1', titre: '  Gymnase municipal ', creeLe: new Date('2026-08-10T09:00:00').toISOString(), notes }
}

describe('dateMission', () => {
  it('prend le jour de la première note', () => {
    expect(dateMission(carnet([note('b', '23:30'), note('a', '08:00')]))).toBe('2026-08-14')
  })
  it('prend le jour de création si le carnet est vide', () => {
    expect(dateMission(carnet([]))).toBe('2026-08-10')
  })
})

describe('meilleurPointGps', () => {
  it('retient le point le plus précis', () => {
    const c = carnet([
      note('a', '10:00', { lat: 1, lon: 1, precisionM: 40 }),
      note('b', '10:01', { lat: 2, lon: 2, precisionM: 8 }),
      note('c', '10:02'),
    ])
    expect(meilleurPointGps(c)).toEqual({ lat: 2, lon: 2, precisionM: 8 })
  })
  it('ignore un GPS trop imprécis', () => {
    expect(meilleurPointGps(carnet([note('a', '10:00', { lat: 1, lon: 1, precisionM: 900 })]))).toBeUndefined()
  })
  it('renvoie undefined sans GPS', () => {
    expect(meilleurPointGps(carnet([note('a', '10:00')]))).toBeUndefined()
  })
})

describe('brouillonDepuisCarnet', () => {
  it('pré-remplit bâtiment, date, adresse et lie le carnet', () => {
    const d = brouillonDepuisCarnet(carnet([note('a', '10:00')]), '1 Rue X 17310 Saint-Pierre')
    expect(d.carnetId).toBe('c1')
    expect(d.mission?.batiment).toBe('Gymnase municipal')
    expect(d.mission?.date).toBe('2026-08-14')
    expect(d.mission?.adresse).toBe('1 Rue X 17310 Saint-Pierre')
    expect(d.photos ?? []).toEqual([])
  })
})
