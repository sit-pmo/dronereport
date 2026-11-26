import { Buffer } from 'buffer'
;(globalThis as Record<string, unknown>).Buffer = Buffer

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hydrateDrafts } from './lib/reportDraft'
import { hydrateCarnets } from './lib/notesTerrain'

// Recharge les rapports et carnets stockés dans IndexedDB avant le premier
// rendu, pour que les pages puissent les lire de façon synchrone.
Promise.all([hydrateDrafts(), hydrateCarnets()]).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

// Service worker (mode hors ligne) — uniquement en production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) =>
      console.warn('[sw] enregistrement impossible', err),
    )
  })
}

// Demande au navigateur de ne pas effacer les données locales quand il manque
// de place (sinon rapports et carnets pourraient disparaître sans prévenir).
navigator.storage?.persist?.().catch(() => {})
