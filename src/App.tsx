/**
 * Routage de l'édition collectivité.
 *
 * HashRouter (URL en /#/mission) : GitHub Pages ne sait pas renvoyer
 * index.html pour une URL inconnue, le hash évite les 404 au rechargement.
 */
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DraftContext, useDraftRoot } from './hooks/useDraft'
import AppLayout from './components/AppLayout'
import DesktopOnly from './components/DesktopOnly'
import Accueil from './pages/Accueil'
import InfosMission from './pages/InfosMission'
import Annotate from './pages/Annotate'
import Photos from './pages/Photos'
import Preview from './pages/Preview'
import SituationMap from './pages/SituationMap'
import PhotosTerrain from './pages/PhotosTerrain'
import AnnotateTerrain from './pages/AnnotateTerrain'
import NotesTerrain from './pages/NotesTerrain'
import RattacherNotes from './pages/RattacherNotes'
import { useIsMobile } from './hooks/useIsMobile'

/** Page d'entrée : notes terrain sur téléphone, rapports sur ordinateur. */
function Entree() {
  const isMobile = useIsMobile()
  return <Navigate to={isMobile ? '/terrain' : '/app'} replace />
}

function AppRoutes() {
  const draftCtx = useDraftRoot()

  return (
    <DraftContext.Provider value={draftCtx}>
      <Routes>
        <Route path="/" element={<Entree />} />
        {/* Mode terrain : plein écran, pensé pour le téléphone */}
        <Route path="/terrain" element={<NotesTerrain />} />
        <Route path="*" element={
          <AppLayout>
            <Routes>
              <Route path="/app" element={<Accueil />} />
              <Route path="/mission" element={<DesktopOnly><InfosMission /></DesktopOnly>} />
              <Route path="/annotate" element={<DesktopOnly><Annotate /></DesktopOnly>} />
              <Route path="/photos" element={<DesktopOnly><Photos /></DesktopOnly>} />
              <Route path="/preview" element={<DesktopOnly><Preview /></DesktopOnly>} />
              <Route path="/situation" element={<DesktopOnly><SituationMap /></DesktopOnly>} />
              <Route path="/photos-terrain" element={<DesktopOnly><PhotosTerrain /></DesktopOnly>} />
              <Route path="/annotate-terrain/:photoId" element={<DesktopOnly><AnnotateTerrain /></DesktopOnly>} />
              <Route path="/rattacher-notes" element={<DesktopOnly><RattacherNotes /></DesktopOnly>} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </AppLayout>
        } />
      </Routes>
    </DraftContext.Provider>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
