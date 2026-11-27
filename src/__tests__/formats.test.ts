/**
 * Formats des fichiers d'échange (.json) : nouveau marqueur « dronereport/… »,
 * ancien marqueur « dronereport-collectivite/… » toujours accepté à l'import.
 */
import { describe, it, expect } from 'vitest'
import { parseDraftFile } from '../lib/draftFile'
import { parseCarnet, carnetToJson } from '../lib/notesTerrain'
import { createPhotoDraft } from '../lib/reportDraft'
import { carnetExemple } from '../lib/exemple'

describe('rapport .json', () => {
  const draft = createPhotoDraft()
  it('lit le nouveau format', () => {
    const txt = JSON.stringify({ format: 'dronereport/rapport', version: 1, draft })
    expect(parseDraftFile(txt).sessionUuid).toBe(draft.sessionUuid)
  })
  it('lit encore les fichiers exportés avant le changement de nom', () => {
    const txt = JSON.stringify({ format: 'dronereport-collectivite/rapport', version: 1, draft })
    expect(parseDraftFile(txt).sessionUuid).toBe(draft.sessionUuid)
  })
  it('refuse un autre fichier, sans parler d\'édition', () => {
    expect(() => parseDraftFile(JSON.stringify({ format: 'autre', draft }))).toThrow("Ce fichier n'est pas un rapport DroneReport.")
  })
})

describe('carnet .json', () => {
  const carnet = carnetExemple()
  it('exporte avec le nouveau marqueur et se relit', () => {
    const json = carnetToJson(carnet) as { format: string }
    expect(json.format).toBe('dronereport/carnet')
    expect(parseCarnet(JSON.stringify(json)).id).toBe(carnet.id)
  })
  it('lit encore les carnets exportés avant le changement de nom', () => {
    const txt = JSON.stringify({ format: 'dronereport-collectivite/carnet', version: 1, carnet })
    expect(parseCarnet(txt).notes).toHaveLength(3)
  })
})
