export function formatDist(m: number): string {
  return m >= 1 ? `${m.toFixed(1).replace('.', ',')} m` : `${Math.round(m * 100)} cm`
}

export function formatArea(m2: number): string {
  return m2 >= 1 ? `${m2.toFixed(1).replace('.', ',')} m²` : `${Math.round(m2 * 10000)} cm²`
}
