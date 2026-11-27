/**
 * Tests du mode « Essayer avec un exemple » et de la visite guidée.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { creerExemple, supprimerExemple, carnetExemple, ID_CARNET_EXEMPLE, PHOTOS_EXEMPLE } from '../lib/exemple'
import { findExistingDrafts } from '../lib/reportDraft'
import { getCarnet } from '../lib/notesTerrain'
import { ETAPES_VISITE, ETAPES_VISITE_TERRAIN, etapeDeReprise, versDriver } from '../lib/visiteGuidee'

beforeEach(() => {
  localStorage.clear()
  supprimerExemple()
})

describe('rapport d\'exemple', () => {
  it('crée un rapport marqué, relié à son carnet, avec une mission complète', () => {
    const d = creerExemple()
    expect(d.exemple).toBe(true)
    expect(d.carnetId).toBe(ID_CARNET_EXEMPLE)
    expect(getCarnet(ID_CARNET_EXEMPLE)?.notes).toHaveLength(3)
    // Champs obligatoires du formulaire mission : le bouton « Continuer » est actif
    const m = d.mission!
    for (const v of [m.batiment, m.clientNom, m.adresse, m.drone, m.telepilote]) expect(v?.trim()).toBeTruthy()
  })

  it('un seul exemple à la fois, supprimé avec son carnet', () => {
    creerExemple()
    creerExemple()
    expect(findExistingDrafts().filter((d) => d.exemple)).toHaveLength(1)
    supprimerExemple()
    expect(findExistingDrafts().filter((d) => d.exemple)).toHaveLength(0)
    expect(getCarnet(ID_CARNET_EXEMPLE)).toBeNull()
  })

  it('chaque note tombe 0 à 60 s après une photo d\'exemple (heure de Paris)', () => {
    // Heures EXIF des photos (scripts/guide/photos_exemple.py), en heure « murale »
    const photos = ['10:02:10', '10:05:40', '10:09:05'].map((h) => {
      const [hh, mm, ss] = h.split(':').map(Number)
      return hh * 3600 + mm * 60 + ss
    })
    const enParis = (iso: string) => {
      const t = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
      const [hh, mm, ss] = t.split(':').map(Number)
      return hh * 3600 + mm * 60 + ss
    }
    carnetExemple().notes.forEach((n, i) => {
      const ecart = enParis(n.prisLe) - photos[i]
      expect(ecart).toBeGreaterThanOrEqual(0)
      expect(ecart).toBeLessThanOrEqual(60)
    })
  })

  it('les photos d\'exemple sont bien servies par le site', () => {
    const presentes = readdirSync('public/exemple')
    for (const p of PHOTOS_EXEMPLE) expect(presentes).toContain(p)
  })
})

describe('visite guidée', () => {
  it('chaque élément visé existe dans le code des pages', () => {
    // Concatène le source des pages et composants
    const sources = ['src/pages', 'src/components']
      .flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => readFileSync(join(dir, f), 'utf8')))
      .join('\n')
    for (const e of [...ETAPES_VISITE, ...ETAPES_VISITE_TERRAIN]) {
      if (!e.element) continue
      const tour = e.element.match(/data-tour="([^"]+)"/)
      const guide = e.element.match(/data-guide="([^"]+)"/)
      const id = e.element.match(/^#([\w-]+)$/)
      if (tour) expect(sources, e.element).toContain(`data-tour="${tour[1]}"`)
      else if (guide) expect(sources, e.element).toContain(`data-guide="${guide[1]}"`)
      else if (id) expect(sources, e.element).toContain(`id="${id[1]}"`)
      // Autres sélecteurs (.leaflet-container) : fournis par une bibliothèque
    }
  })

  it('se termine par une bulle sans élément, et chaque étape « clic » vise un élément', () => {
    for (const etapes of [ETAPES_VISITE, ETAPES_VISITE_TERRAIN]) {
      expect(etapes.at(-1)?.element).toBeUndefined()
      for (const e of etapes) if (e.action) expect(e.element).toBeTruthy()
    }
  })

  it('« Suivant » garde son action par défaut sauf sur les étapes qui changent d\'écran', () => {
    // driver.js recopie les options de la bulle par-dessus les siennes :
    // une clé onNextClick vide bloquerait le bouton « Suivant »
    for (const parcours of ['bureau', 'terrain'] as const) {
      const etapes = parcours === 'bureau' ? ETAPES_VISITE : ETAPES_VISITE_TERRAIN
      versDriver(parcours).forEach((d, i) => {
        expect('onNextClick' in (d.popover ?? {}), `${parcours} étape ${i + 1}`).toBe(!!etapes[i].allerA)
      })
    }
  })

  it('reprend à la dernière étape vue si elle est sur l\'écran, sinon au début de l\'écran', () => {
    const premiereRattacher = ETAPES_VISITE.findIndex((e) => e.route === '/rattacher-notes')
    expect(etapeDeReprise('/rattacher-notes', premiereRattacher + 1)).toBe(premiereRattacher + 1)
    expect(etapeDeReprise('/rattacher-notes', 0)).toBe(premiereRattacher)
    expect(etapeDeReprise('/annotate-terrain/abc', null)).toBe(ETAPES_VISITE.findIndex((e) => e.route === '/annotate-terrain'))
    expect(etapeDeReprise('/inconnu', null)).toBe(0)
  })
})
