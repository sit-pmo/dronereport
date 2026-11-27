/**
 * Visite guidée dans l'application (bibliothèque driver.js, licence MIT).
 *
 * Deux parcours :
 * - « bureau » (ordinateur) : accompagne le rapport d'exemple (lib/exemple.ts)
 *   du formulaire mission jusqu'au PDF ;
 * - « terrain » (téléphone) : la prise de notes, sur un carnet d'essai.
 * L'écran s'assombrit, une bulle pointe le vrai bouton.
 * - Étape « suivant » : on lit, puis « Suivant ».
 * - Étape « clic » : on clique soi-même sur le bouton surligné ; la visite
 *   avance et attend que l'écran suivant affiche l'élément visé.
 *
 * Les éléments sont visés par des attributs `data-tour="…"` posés dans les
 * pages (plus stables que les libellés). Un test vérifie qu'ils existent.
 * driver.js n'est chargé qu'au lancement de la visite (import dynamique).
 */
import type { Driver, DriveStep } from 'driver.js'

/** Une étape de la visite. */
export interface EtapeVisite {
  /** Écran où se trouve l'élément (début du chemin, ex. « /photos-terrain »). */
  route: string
  /** Élément surligné (sélecteur CSS). Absent : bulle centrée. */
  element?: string
  titre: string
  texte: string
  /**
   * « clic » : l'utilisateur clique sur l'élément pour avancer ;
   * « envoi » : il valide le formulaire surligné (taper dans le champ ne fait pas avancer).
   * Défaut : bouton « Suivant ».
   */
  action?: 'clic' | 'envoi'
  /** Côté de la bulle par rapport à l'élément. */
  cote?: 'top' | 'right' | 'bottom' | 'left'
  /** Étape « clic » : n'avancer qu'au clic sur ce sous-élément de la zone surlignée. */
  clicSur?: string
  /** Étape « suivant » : écran à ouvrir au clic sur « Suivant » (l'étape suivante est sur cet écran). */
  allerA?: string
}

/** Sélecteur d'un attribut data-tour. */
const t = (nom: string) => `[data-tour="${nom}"]`

export const ETAPES_VISITE: EtapeVisite[] = [
  {
    route: '/app', element: t('accueil-demarrer'), cote: 'bottom', allerA: '/mission',
    titre: 'Deux façons de commencer',
    texte: "Sur le terrain, prenez vos notes sur le téléphone (« Notes terrain »), puis importez-les ici avec « Importer un rapport ou un carnet » : le rapport démarre pré-rempli. Pour commencer directement sur l'ordinateur : « + Nouveau rapport ». Pour l'exemple, un carnet est déjà importé : cliquez sur « Suivant ».",
  },
  {
    route: '/mission', element: '#batiment', cote: 'bottom',
    titre: 'Un rapport déjà pré-rempli',
    texte: "Le carnet de l'exemple contient 3 défauts notés au téléphone pendant le vol. En l'important, le bâtiment et la date se sont remplis seuls.",
  },
  {
    route: '/mission', element: '#adresse', cote: 'bottom',
    titre: 'Adresse',
    texte: "Proposée d'après le GPS du téléphone (précis à ~100 m) : toujours la vérifier.",
  },
  {
    route: '/mission', element: '#telepilote', cote: 'top',
    titre: 'Champs obligatoires',
    texte: 'Demandeur, drone, télépilote, exploitant… Les champs marqués * sont à compléter. Ici, déjà remplis pour l\'exemple.',
  },
  {
    route: '/mission', element: t('mission-continuer'), cote: 'top', action: 'clic',
    titre: 'À vous',
    texte: 'Cliquez sur « Continuer » pour passer aux photos.',
  },
  {
    route: '/photos', element: t('choix-ortho'), cote: 'right',
    titre: 'Avec une ortho (recommandé)',
    texte: "Si vous avez une orthophoto du toit (Pix4D, WebODM…), on annote directement dessus.",
  },
  {
    route: '/photos', element: t('sans-ortho'), cote: 'top', action: 'clic',
    titre: 'Sans ortho',
    texte: 'Plan de situation, puis photos du drone : c\'est ce parcours qui reprend les notes du téléphone. Cliquez sur « Continuer sans ortho ».',
  },
  {
    route: '/situation', element: '.leaflet-container', cote: 'top',
    titre: 'Plan de situation',
    texte: 'Zoomez sur le bâtiment et cliquez pour placer le marqueur. Il servira de plan en tête du rapport.',
  },
  {
    route: '/situation', element: t('capturer-plan'), cote: 'top', action: 'clic',
    titre: 'À vous',
    texte: 'Cliquez sur « Capturer ce plan de situation ».',
  },
  {
    route: '/photos-terrain', element: t('photos-exemple'), cote: 'bottom', action: 'clic',
    titre: 'Les photos du drone',
    texte: "En vrai : « + Ajouter des photos », avec les fichiers d'origine copiés depuis la carte SD. Ici, chargez les 3 photos d'exemple.",
  },
  {
    route: '/photos-terrain', element: t('photo-ligne'), cote: 'bottom',
    titre: 'Heure de prise de vue',
    texte: "Chaque photo affiche l'heure lue dans le fichier (« Prise à … »). C'est elle qui permet de retrouver les notes.",
  },
  {
    route: '/photos-terrain', element: t('rattacher'), cote: 'top', action: 'clic',
    titre: 'Reprendre les notes du téléphone',
    texte: 'Cliquez sur « Rattacher les notes terrain ».',
  },
  {
    route: '/rattacher-notes', element: t('rattachement-table'), cote: 'top',
    titre: 'Chaque note trouve sa photo',
    texte: "La note est proposée sur la photo prise au même moment (colonne « Écart »). Changez la photo dans la liste si besoin.",
  },
  {
    route: '/rattacher-notes', element: t('decalage'), cote: 'bottom',
    titre: 'Horloge du drone',
    texte: "Si presque toutes les notes tombent à côté, l'horloge du drone est décalée : réglez le décalage ou « Estimer automatiquement ».",
  },
  {
    route: '/rattacher-notes', element: t('valider-rattachement'), cote: 'top', action: 'clic',
    titre: 'À vous',
    texte: 'Cliquez sur « Valider » : chaque note devient un point sur sa photo.',
  },
  {
    route: '/photos-terrain', element: t('annoter'), cote: 'left', action: 'clic',
    titre: 'Placer les points',
    texte: 'Ouvrez la première photo avec « ✏ Annoter ».',
  },
  {
    route: '/annotate-terrain', element: '[data-guide="canvas"]', cote: 'right',
    titre: 'Glisser le point sur le défaut',
    texte: 'La note arrive au centre de la photo. Faites glisser le point sur la tuile cassée.',
  },
  {
    route: '/annotate-terrain', element: t('annotations'), cote: 'left',
    titre: 'Texte et gravité',
    texte: 'Le texte et la gravité de la note sont repris, et restent modifiables. Les outils en haut ajoutent d\'autres défauts.',
  },
  {
    route: '/annotate-terrain', element: t('retour-photos'), cote: 'bottom', action: 'clic',
    titre: 'À vous',
    texte: 'Revenez à la liste des photos avec « ← Retour ».',
  },
  {
    route: '/photos-terrain', element: t('generer-apercu'), cote: 'top', action: 'clic',
    titre: 'Le rapport',
    texte: 'Cliquez sur « Générer l\'aperçu PDF ».',
  },
  {
    route: '/preview', element: t('telecharger-pdf'), cote: 'top',
    titre: 'Le livrable',
    texte: '« Télécharger le PDF » produit le rapport à transmettre.',
  },
  {
    route: '/preview', element: t('enregistrer-json'), cote: 'top',
    titre: 'Garder le rapport',
    texte: "Enregistrez le rapport en .json pour le reprendre plus tard ou le passer à un collègue : le navigateur peut l'effacer.",
  },
  {
    route: '/preview',
    titre: 'Terminé !',
    texte: "Vous avez fait tout le parcours. Le rapport d'exemple reste dans la liste de l'accueil (badge « Exemple ») : supprimez-le quand vous voulez. Pour la prise de notes au téléphone, voir le Guide.",
  },
]

/** Visite du mode terrain (téléphone) : prise de notes sur un carnet d'essai. */
export const ETAPES_VISITE_TERRAIN: EtapeVisite[] = [
  {
    route: '/terrain', element: t('terrain-nouveau'), cote: 'bottom', action: 'envoi',
    titre: 'Un carnet par mission',
    texte: "Tapez un nom (ex. « Essai »), puis touchez « Nouveau ». En vrai : le nom du bâtiment inspecté.",
  },
  {
    route: '/terrain', element: t('terrain-texte'), cote: 'bottom',
    titre: 'Ce que vous voyez',
    texte: "Une note par défaut vu à l'écran du drone. Phrase courte ; le micro du clavier permet de dicter.",
  },
  {
    route: '/terrain', element: t('terrain-gravite'), cote: 'bottom',
    titre: 'Gravité (facultatif)',
    texte: 'Si vous la connaissez. Elle reste modifiable au bureau.',
  },
  {
    // Tout le bloc de saisie est surligné (on doit pouvoir écrire et choisir la gravité),
    // bulle en dessous pour ne pas cacher le champ ; on avance au toucher sur « Ajouter »
    route: '/terrain', element: t('terrain-saisie'), cote: 'bottom', action: 'clic', clicSur: t('terrain-ajouter'),
    titre: 'À vous',
    texte: "Écrivez une note d'essai (ex. « tuile cassée »), puis touchez « + Ajouter la note ».",
  },
  {
    route: '/terrain', element: t('terrain-note'), cote: 'top',
    titre: 'Heure et position',
    texte: "Chaque note garde l'heure (et la position si vous l'autorisez). Au bureau, c'est l'heure qui retrouve la photo du drone prise au même moment.",
  },
  {
    route: '/terrain', element: t('terrain-repere'), cote: 'top',
    titre: 'Pas le temps d\'écrire ?',
    texte: '« ⏱ Repère » marque juste l\'heure. Vous compléterez au bureau.',
  },
  {
    route: '/terrain', element: t('terrain-exporter'), cote: 'bottom',
    titre: 'En fin de vol',
    texte: "« Exporter » envoie le carnet vers l'ordinateur (mail, Teams…). Sur l'ordinateur : « Importer un rapport ou un carnet ».",
  },
  {
    route: '/terrain',
    titre: "C'est tout !",
    texte: "Pensez à ouvrir la page avec du réseau avant de partir : elle marche ensuite hors ligne. Ce carnet d'essai se supprime avec 🗑 dans la liste des carnets.",
  },
]

/** Parcours disponibles. */
export type Parcours = 'bureau' | 'terrain'
const ETAPES: Record<Parcours, EtapeVisite[]> = { bureau: ETAPES_VISITE, terrain: ETAPES_VISITE_TERRAIN }

// ── Pilotage ─────────────────────────────────────────────────────────────────

const CLE_ETAPE = 'dronereport-visite-etape'
let instance: Driver | null = null
/** Dernière étape affichée dans la visite en cours (pour savoir si elle est allée au bout). */
let derniereVue = -1
/** Parcours de la visite en cours. */
let parcoursEnCours: Parcours = 'bureau'
const abonnes = new Set<(active: boolean) => void>()

/** Prévient les composants (bandeau d'exemple) qu'une visite démarre ou s'arrête. */
function notifier() {
  for (const f of abonnes) f(visiteActive())
}

/** S'abonne aux démarrages / arrêts de la visite. Renvoie la fonction de désabonnement. */
export function ecouterVisite(f: (active: boolean) => void): () => void {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

export function visiteActive(): boolean {
  return !!instance?.isActive()
}

/** Dernière étape affichée (pour reprendre). Stockage de session, sans planter s'il est bloqué. */
function lireEtape(): number | null {
  try {
    const v = sessionStorage.getItem(CLE_ETAPE)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}
function ecrireEtape(i: number | null) {
  try {
    if (i === null) sessionStorage.removeItem(CLE_ETAPE)
    else sessionStorage.setItem(CLE_ETAPE, String(i))
  } catch {
    // Sans gravité : la reprise repartira de l'écran courant
  }
}

/**
 * Étape où reprendre sur l'écran `chemin` : la dernière vue si elle est sur cet
 * écran, sinon la première étape de cet écran, sinon 0.
 */
export function etapeDeReprise(chemin: string, derniere = lireEtape()): number {
  const surEcran = (i: number) => chemin.startsWith(ETAPES_VISITE[i].route)
  if (derniere !== null && ETAPES_VISITE[derniere] && surEcran(derniere)) return derniere
  const i = ETAPES_VISITE.findIndex((e) => chemin.startsWith(e.route))
  return i >= 0 ? i : 0
}

/** Convertit nos étapes en étapes driver.js. */
export function versDriver(parcours: Parcours): DriveStep[] {
  return ETAPES[parcours].map((e, i) => ({
    element: e.element,
    // « clic » : le clic sur le vrai bouton fait avancer ; « envoi » : la validation du formulaire
    advanceOn: e.action === 'envoi'
      ? 'submit'
      : e.action === 'clic'
        ? (e.clicSur
          ? { event: 'click', when: (_el, _step, o) => !!(o.event.target as Element | null)?.closest(e.clicSur!) }
          : 'click')
        : undefined,
    popover: {
      title: e.titre,
      description: e.texte,
      side: e.cote,
      // Pas de retour arrière : l'étape précédente est souvent sur un autre écran
      showButtons: e.action ? ['close'] : ['next', 'close'],
      // « Suivant » qui change d'écran : on ouvre l'écran (HashRouter), puis la
      // visite attend que l'élément suivant s'affiche (waitForElement).
      // Clé posée seulement si besoin : driver.js recopie les options de la bulle
      // par-dessus les siennes, et un « onNextClick: undefined » désactiverait
      // le bouton « Suivant » de toutes les autres étapes.
      ...(e.allerA
        ? {
          onNextClick: (_el, _step, o) => {
            window.location.hash = `#${e.allerA}`
            o.driver.moveNext()
          },
        }
        : {}),
    },
    onHighlighted: () => {
      derniereVue = i
      // Seule la visite « bureau » se reprend (encart du menu)
      if (parcours === 'bureau') ecrireEtape(i)
    },
  }))
}

/** Lance (ou relance) la visite `parcours` à l'étape `depuis`. */
export async function lancerVisite(depuis = 0, parcours: Parcours = 'bureau'): Promise<void> {
  // Chargé à la demande : la bibliothèque ne pèse rien tant qu'on ne s'en sert pas
  const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')])
  instance?.destroy()
  derniereVue = -1
  parcoursEnCours = parcours
  instance = driver({
    steps: versDriver(parcours),
    showProgress: true,
    progressText: 'Étape {{current}} sur {{total}}',
    nextBtnText: 'Suivant →',
    doneBtnText: 'Terminer',
    closeBtnLabel: 'Quitter la visite',
    popoverClass: 'visite-sit',
    // Clic hors de la zone : on ne ferme pas par erreur
    overlayClickBehavior: 'none',
    // Après un clic qui change d'écran, on attend l'élément suivant (capture du plan, photos…)
    waitForElement: 20000,
    stagePadding: 6,
    stageRadius: 8,
    onDestroyed: () => {
      // Visite finie : on oublie l'étape ; quittée en route : on la garde pour « Reprendre »
      const fin = derniereVue === ETAPES[parcoursEnCours].length - 1
      if (fin && parcoursEnCours === 'bureau') ecrireEtape(null)
      instance = null
      notifier()
    },
  })
  instance.drive(depuis)
  notifier()
}

/** Arrête la visite en cours, s'il y en a une. */
export function arreterVisite(): void {
  instance?.destroy()
  ecrireEtape(null)
}
