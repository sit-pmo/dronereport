import { useEffect, useState } from 'react'

// Même seuil que la media query qui masque la sidebar (src/index.css:102) —
// garde les deux mécanismes de détection mobile alignés sur une seule valeur.
export const MOBILE_BREAKPOINT_PX = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX,
  )

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}
