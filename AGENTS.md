# DroneReport

Logiciel libre (AGPL-3.0-or-later, fichier `LICENSE`) porté par le SIT (PETR Marennes Oléron / SyMONT) : notes terrain sur téléphone et rapports PDF d'inspection de toiture par drone. Dépôt public : aucun secret, aucune donnée.
L'appli affiche un lien vers le code source (menu de gauche, Notes terrain, Guide) : le garder, l'AGPL le demande pour une appli en ligne.

## Design

Lire `DESIGN.md` avant toute décision visuelle (palette, polices, espacements).
DESIGN.md ne contient plus que la charte graphique (la partie « produit / tarifs » de l'ancienne version SaaS a été retirée).

## Contraintes d'architecture

1. Aucun serveur, aucun compte, aucun paiement : tout tourne dans le navigateur.
2. Données dans IndexedDB (`src/lib/idbStore.ts`). Jamais d'envoi de photo ou de note vers un service tiers.
3. Photos réduites à 1200 px / 200 Ko avant stockage et avant injection dans react-pdf.
4. Lire les métadonnées (EXIF/XMP) sur le fichier d'origine, avant réduction.
5. Routage en `HashRouter` et `base` Vite = `/dronereport/` (GitHub Pages).
6. Échanges entre postes uniquement par fichiers .json (rapport ou carnet).
7. Code commenté, en français.

## Commandes (PowerShell)

```powershell
npm ci
npm run dev      # http://localhost:5173/dronereport/
npm test
npm run build
npm run captures # captures du guide (après « npx playwright install chromium »)
```

Publication : push sur `main` → GitHub Actions → https://sit-pmo.github.io/dronereport/

## État au 2026-11-27

- Version 1.0.0 : reprise de l'ancienne version SaaS (dépôt privé `aurelienchaumet/dronereport`), paiement et cloud retirés.
  Projet SaaS abandonné le 27/11/2026 : ce dépôt est désormais LE projet DroneReport (plus d'« édition collectivité »).
  Seul reste le nom de la base IndexedDB `dronereport-collectivite`, gardé pour ne pas perdre les données des navigateurs.
- Testée de bout en bout dans Chrome (mobile → PC → PDF) avec des photos factices au format DJI ; 31 tests unitaires.
- Pas encore testée avec une vraie photo DJI ni sur un vrai téléphone en vol.
- Publiée sur GitHub Pages (workflow « Publier sur GitHub Pages » vert).
- Accueil : un carnet de notes terrain s'importe comme un rapport et peut servir de début de rapport
  (bâtiment, date, adresse proche du GPS, carnet lié). Code : `src/lib/rapportDepuisCarnet.ts`.
- Tutoriel : carte d'accueil, page Guide, bandeaux d'aide. Texte du guide dans `src/lib/guide.ts`
  (source unique, reprend les libellés des boutons : à tenir à jour si un bouton change).
- Guide illustré : 10 captures annotées (`public/guide/`, ~640 Ko), produites par `npm run captures`
  avec des données fictives ; repères et légendes dans `src/lib/guideCaptures.json`.
  Si un écran ou un libellé change, relancer `npm run captures`.
- « 🧪 Essayer avec un exemple » (accueil, guide) : rapport + carnet fictifs (`src/lib/exemple.ts`,
  photos dans `public/exemple/`) et visite guidée en 23 étapes de l'accueil jusqu'au PDF (`src/lib/visiteGuidee.ts`,
  driver.js 1.11.0). Les étapes visent des attributs `data-tour` : ne pas les retirer d'une page
  (un test vérifie qu'ils existent).
- Visite guidée téléphone (mode terrain) : « 🧪 Découvrir en 1 minute » dans Notes terrain et dans le
  Guide sur mobile, 8 étapes sur un carnet d'essai (`ETAPES_VISITE_TERRAIN`). Une étape « clic » peut
  surligner une zone entière et n'avancer qu'au clic sur un bouton (`clicSur`) : sinon le voile
  empêche d'utiliser les champs voisins. 55 tests unitaires.
- Points ouverts : voir `contraintes.md` (« À vérifier » sur matériel réel, « À trancher »).
