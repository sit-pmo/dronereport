import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DesktopOnly from '../components/DesktopOnly'

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
}

const ORIGINAL_WIDTH = window.innerWidth

afterEach(() => {
  setViewportWidth(ORIGINAL_WIDTH)
})

describe('DesktopOnly', () => {
  it('affiche le contenu sur un grand écran', () => {
    setViewportWidth(1280)
    render(
      <MemoryRouter>
        <DesktopOnly><p>Contenu protégé</p></DesktopOnly>
      </MemoryRouter>,
    )
    expect(screen.getByText('Contenu protégé')).toBeInTheDocument()
  })

  it('bloque le contenu et propose le retour sur mobile', () => {
    setViewportWidth(390)
    render(
      <MemoryRouter>
        <DesktopOnly><p>Contenu protégé</p></DesktopOnly>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Contenu protégé')).not.toBeInTheDocument()
    expect(screen.getByText('Cette étape nécessite un ordinateur')).toBeInTheDocument()
    expect(screen.getByText('Retour à mes rapports')).toBeInTheDocument()
  })
})
