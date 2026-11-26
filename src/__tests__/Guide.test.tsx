/**
 * Tests du tutoriel : mémoire des aides masquées, bandeau d'aide, page Guide.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AideEcran from '../components/AideEcran'
import Guide from '../pages/Guide'
import { aideMasquee, masquerAide, reafficherAides } from '../lib/aidesVues'
import { ETAPES_GUIDE } from '../lib/guide'

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
}
const ORIGINAL_WIDTH = window.innerWidth

beforeEach(() => localStorage.clear())
afterEach(() => setViewportWidth(ORIGINAL_WIDTH))

describe('aidesVues', () => {
  it('retient une aide masquée et la réaffiche', () => {
    expect(aideMasquee('x')).toBe(false)
    masquerAide('x')
    masquerAide('x') // pas de doublon
    expect(aideMasquee('x')).toBe(true)
    expect(JSON.parse(localStorage.getItem('dronereport-aides-masquees')!)).toEqual(['x'])
    reafficherAides()
    expect(aideMasquee('x')).toBe(false)
  })

  it('ignore un stockage corrompu', () => {
    localStorage.setItem('dronereport-aides-masquees', '{pas du json')
    expect(aideMasquee('x')).toBe(false)
  })
})

describe('AideEcran', () => {
  it('s\'affiche puis se masque durablement', () => {
    const { unmount } = render(<MemoryRouter><AideEcran id="test">Texte d'aide</AideEcran></MemoryRouter>)
    expect(screen.getByText("Texte d'aide")).toBeInTheDocument()
    fireEvent.click(screen.getByText('Masquer'))
    expect(screen.queryByText("Texte d'aide")).not.toBeInTheDocument()
    unmount()
    // Nouvelle visite : toujours masquée
    render(<MemoryRouter><AideEcran id="test">Texte d'aide</AideEcran></MemoryRouter>)
    expect(screen.queryByText("Texte d'aide")).not.toBeInTheDocument()
  })
})

describe('Guide', () => {
  it('montre les 5 étapes sur ordinateur', () => {
    setViewportWidth(1280)
    render(<MemoryRouter><Guide /></MemoryRouter>)
    for (const e of ETAPES_GUIDE) expect(screen.getByText(e.titre)).toBeInTheDocument()
  })

  it('ne montre que les étapes téléphone sur mobile, puis tout sur demande', () => {
    setViewportWidth(390)
    render(<MemoryRouter><Guide /></MemoryRouter>)
    expect(screen.getByText('Notes au téléphone')).toBeInTheDocument()
    expect(screen.queryByText('Aperçu et PDF')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Voir aussi les étapes sur ordinateur/))
    expect(screen.getByText('Aperçu et PDF')).toBeInTheDocument()
  })
})

describe('captures du guide', () => {
  it('chaque capture déclarée existe dans public/guide et vise une étape du guide', async () => {
    // Import dynamique : modules Node, seulement pour ce test
    const { existsSync } = await import('node:fs')
    const { CAPTURES_GUIDE } = await import('../lib/guide')
    const etapes = new Set(ETAPES_GUIDE.map((e) => e.n))
    for (const c of CAPTURES_GUIDE) {
      expect(existsSync(`public/guide/${c.fichier}`), c.fichier).toBe(true)
      expect(etapes.has(c.etape), c.id).toBe(true)
      // Repères numérotés 1, 2, 3… sans trou
      expect(c.reperes.map((r) => r.n)).toEqual(c.reperes.map((_, i) => i + 1))
    }
  })
})
