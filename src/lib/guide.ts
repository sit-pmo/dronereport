/**
 * Contenu du tutoriel (carte d'accueil, page Guide, aides en contexte).
 *
 * Source unique : la carte d'accueil et la page Guide lisent les mêmes
 * étapes, pour qu'elles ne divergent pas. Les libellés entre « » sont ceux
 * des boutons de l'application : les garder à jour si un bouton change.
 *
 * Les captures annotées et leurs légendes sont dans guideCaptures.json
 * (images dans public/guide/, régénérées par « npm run captures »).
 */
import capturesJson from './guideCaptures.json'

/** Une étape du parcours, de la note sur le terrain au PDF. */
export interface EtapeGuide {
  /** Numéro affiché dans la frise. */
  n: number
  /** Appareil sur lequel se fait l'étape. */
  appareil: 'Téléphone' | 'Ordinateur'
  /** Titre court (frise de la carte d'accueil). */
  titre: string
  /** Ce qu'on fait, dans l'ordre. */
  faire: string[]
  /** Le piège à éviter à cette étape. */
  piege: string
}

export const ETAPES_GUIDE: EtapeGuide[] = [
  {
    n: 1,
    appareil: 'Téléphone',
    titre: 'Notes au téléphone',
    faire: [
      "Ouvrir le site sur le téléphone avant de partir : il passe tout seul en mode « Notes terrain ».",
      'Créer un carnet par mission, au nom du bâtiment (ex. « Gymnase Saint-Pierre »).',
      'Pendant le vol, une note par défaut vu à l\'écran : texte court (la dictée du clavier marche), gravité si on la connaît.',
      "L'heure est enregistrée à chaque note, et la position si on autorise la localisation.",
    ],
    piege: "Charger la page avec du réseau avant d'aller sur le terrain : ensuite, elle marche hors réseau.",
  },
  {
    n: 2,
    appareil: 'Téléphone',
    titre: 'Export du carnet',
    faire: [
      'Dans le carnet, toucher « Exporter ».',
      "Choisir mail, Teams, Drive… dans le menu « Partager », ou garder le fichier téléchargé.",
      'Récupérer ce fichier .json sur l\'ordinateur.',
    ],
    piege: "Le carnet ne vit que dans ce téléphone : vider le cache du navigateur l'efface. Exporter dès la fin du vol.",
  },
  {
    n: 3,
    appareil: 'Ordinateur',
    titre: 'Démarrer le rapport',
    faire: [
      "Accueil : « Importer un rapport ou un carnet (.json) », choisir le carnet, puis « Créer un rapport à partir de ce carnet ». Bâtiment, date et adresse sont pré-remplis.",
      "Sans carnet : « + Nouveau rapport ».",
      'Compléter « Informations mission » : exploitant, télépilote, catégorie de vol, déclaration préfecture si vol en agglomération.',
    ],
    piege: "L'adresse proposée vient du GPS du téléphone, souvent précis à 100 m près : la vérifier.",
  },
  {
    n: 4,
    appareil: 'Ordinateur',
    titre: 'Photos et annotations',
    faire: [
      "Avec une ortho (recommandé) : « + Importer l'ortho », puis « ✏ Annoter » pour placer les défauts.",
      "Sans ortho : « Continuer sans ortho », faire le plan de situation IGN, puis « Photos terrain » et importer les photos du drone.",
      "Pour reprendre les notes du téléphone : « Photos terrain » → « Rattacher les notes terrain ». Chaque note est proposée sur la photo prise au même moment ; corriger si besoin, valider.",
      'Ouvrir chaque photo et déplacer le point sur le défaut.',
    ],
    piege: "Importer les photos d'origine, copiées depuis la carte SD : une photo passée par une messagerie perd l'heure et le GPS, et le rattachement ne marche plus. Si toutes les notes tombent à côté, l'horloge du drone est décalée : régler « Décalage horloge drone ».",
  },
  {
    n: 5,
    appareil: 'Ordinateur',
    titre: 'Aperçu et PDF',
    faire: [
      '« Aperçu PDF » : relire, corriger via « Modifier : Infos mission / Photos & annotations ».',
      '« Télécharger le PDF → » : c\'est le livrable.',
      "« Enregistrer le rapport (.json) » pour le garder, le reprendre plus tard ou le passer à un collègue.",
    ],
    piege: 'Rapports et carnets restent dans ce navigateur, sur ce poste. Sans export .json, un nettoyage du navigateur les efface.',
  },
]

/** Règles à rappeler à tout nouvel utilisateur. */
export const REGLES_GUIDE: string[] = [
  "Rien n'est envoyé sur un serveur : rapports, photos et notes restent dans le navigateur. Seule l'adresse et le plan de situation interrogent des services publics (Base Adresse Nationale, IGN).",
  "Aucune donnée nominative : pas de nom de particulier dans les notes ni le rapport, pas de personne ni de plaque reconnaissable sur les photos.",
  "Un fichier .json sert à passer d'un appareil à l'autre : carnet (téléphone → ordinateur) ou rapport complet (ordinateur → ordinateur).",
]

/** Un repère numéroté posé sur une capture. */
export interface RepereCapture {
  n: number
  legende: string
}

/** Une capture annotée, rattachée à une étape du guide. */
export interface CaptureGuide {
  id: string
  etape: number
  appareil: 'Téléphone' | 'Ordinateur'
  fichier: string
  titre: string
  reperes: RepereCapture[]
}

/** Toutes les captures, dans l'ordre du parcours. */
export const CAPTURES_GUIDE: CaptureGuide[] = capturesJson.captures as CaptureGuide[]

/** Captures d'une étape. */
export function capturesEtape(n: number): CaptureGuide[] {
  return CAPTURES_GUIDE.filter((c) => c.etape === n)
}

/** URL publique d'une capture (base Vite = /dronereport/). */
export function urlCapture(c: CaptureGuide): string {
  return `${import.meta.env.BASE_URL}guide/${c.fichier}`
}
