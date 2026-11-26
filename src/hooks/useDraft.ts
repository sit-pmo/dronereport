import { useState, useEffect, createContext, useContext } from 'react'
import type { ReportDraft } from '../types'
import { findExistingDrafts } from '../lib/reportDraft'

// Global draft state — shared across all pages via context (set up in App.tsx)
export interface DraftContextValue {
  draft: ReportDraft | null
  setDraft: (d: ReportDraft) => void
}

export const DraftContext = createContext<DraftContextValue>({
  draft: null,
  setDraft: () => {},
})

export function useDraft() {
  return useContext(DraftContext)
}

export function useDraftRoot(): DraftContextValue {
  const [draft, setDraftState] = useState<ReportDraft | null>(null)

  useEffect(() => {
    const existing = findExistingDrafts()
    if (existing.length > 0) {
      setDraftState(existing[0])
    }
    // Don't auto-create — let Accueil create on "Nouveau rapport" click
  }, [])

  function setDraft(d: ReportDraft) {
    setDraftState(d)
  }

  return { draft, setDraft }
}
