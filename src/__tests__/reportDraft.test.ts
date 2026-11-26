import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPhotoDraft,
  saveDraft,
  loadDraft,
  updateDraftMission,
  updateDraftConclusion,
  updateDraftOrtho,
} from '../lib/reportDraft'
import type { MissionInfos, PhotoItem } from '../types'

beforeEach(() => {
  localStorage.clear()
})

describe('createPhotoDraft', () => {
  it('creates a blank draft', () => {
    const draft = createPhotoDraft()
    expect(draft.sessionUuid).toBeTruthy()
    expect(draft.mission).toBeNull()
    expect(draft.ortho).toBeNull()
  })
})

describe('saveDraft / loadDraft', () => {
  it('round-trips a draft through localStorage', () => {
    const draft = createPhotoDraft()
    saveDraft(draft)
    const loaded = loadDraft(draft.sessionUuid)
    expect(loaded?.sessionUuid).toBe(draft.sessionUuid)
  })

  it('returns null for missing draft', () => {
    expect(loadDraft('nonexistent-uuid')).toBeNull()
  })
})

describe('updateDraftMission', () => {
  it('updates mission without mutating original', () => {
    const draft = createPhotoDraft()
    const mission: MissionInfos = {
      clientNom: 'Test Client',
      clientEmail: 'test@test.com',
      adresse: '1 rue Test',
      date: '2026-05-29',
      typeInspection: 'toiture',
      meteo: 'Ensoleillé',
      drone: 'DJI Mini 4 Pro',
    }
    const updated = updateDraftMission(draft, mission)
    expect(updated.mission?.clientNom).toBe('Test Client')
    expect(draft.mission).toBeNull()
  })
})

describe('updateDraftConclusion', () => {
  it('updates conclusion without mutating original', () => {
    const draft = createPhotoDraft()
    const updated = updateDraftConclusion(draft, 'RAS')
    expect(updated.conclusion).toBe('RAS')
    expect(draft.conclusion).toBe('')
  })
})

describe('updateDraftOrtho', () => {
  it('sets and round-trips the ortho through localStorage', () => {
    const draft = createPhotoDraft()
    const ortho: Omit<PhotoItem, '_file'> = {
      id: 'o1',
      status: 'done',
      storageUrl: 'https://example.com/ortho.jpg',
      annotations: [
        { id: 'a1', type: 'pin', label: 'Hotspot', severity: 'grave', x: 0.3, y: 0.4 },
      ],
    }
    const updated = updateDraftOrtho(draft, ortho)
    saveDraft(updated)
    const loaded = loadDraft(draft.sessionUuid)
    expect(loaded?.ortho?.id).toBe('o1')
    expect(loaded?.ortho?.annotations?.[0].severity).toBe('grave')
  })

  it('clears the ortho when set to null', () => {
    const draft = createPhotoDraft()
    const withOrtho = updateDraftOrtho(draft, { id: 'o1', status: 'done' })
    const cleared = updateDraftOrtho(withOrtho, null)
    expect(cleared.ortho).toBeNull()
  })
})
