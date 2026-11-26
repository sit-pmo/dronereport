import { describe, it, expect } from 'vitest'
import { formatDist, formatArea } from '../measureFormat'

describe('formatDist', () => {
  it('affiche en mètres si >= 1 m', () => {
    expect(formatDist(1)).toBe('1,0 m')
    expect(formatDist(12.4)).toBe('12,4 m')
    expect(formatDist(1.0)).toBe('1,0 m')
  })
  it('affiche en cm si < 1 m', () => {
    expect(formatDist(0.84)).toBe('84 cm')
    expect(formatDist(0.5)).toBe('50 cm')
    expect(formatDist(0.099)).toBe('10 cm')
  })
})

describe('formatArea', () => {
  it('affiche en m² si >= 1 m²', () => {
    expect(formatArea(1)).toBe('1,0 m²')
    expect(formatArea(34.2)).toBe('34,2 m²')
  })
  it('affiche en cm² si < 1 m²', () => {
    expect(formatArea(0.0084)).toBe('84 cm²')
    expect(formatArea(0.005)).toBe('50 cm²')
  })
})
