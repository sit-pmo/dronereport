# Changelog

## [Non publié]

### Ajouté
- Licence libre GNU AGPL v3.0 ou ultérieure (`LICENSE`) ; lien « code source » dans l'appli
  (menu de gauche, Notes terrain, Guide).
- Plan de situation : repères numérotés des photos terrain (numéro = « Photo N » du PDF), à glisser sur
  le point photographié, placement à la main des photos sans GPS, « Ajuster la vue », alerte si le plan
  n'est plus à jour. Bouton « 📍 Localiser les photos sur le plan » dans Photos terrain. Dans le PDF,
  « Repère N sur le plan de situation » sur chaque page photo. Position du bâtiment gardée dans le rapport.

### Changé
- Visite guidée de l'exemple : démarre sur l'accueil (importer un carnet ou « + Nouveau rapport »),
  23 étapes. Corrigé : « Suivant » bloqué à partir de l'étape 2.
- Fin de « l'édition collectivité » : l'application s'appelle simplement DroneReport (menu, accueil,
  titre, appli installée, pied de page du PDF, paquet npm). Le projet SaaS est abandonné.
- Fichiers .json exportés avec le marqueur `dronereport/rapport` et `dronereport/carnet` ; les fichiers
  plus anciens (`dronereport-collectivite/…`) s'importent toujours.

### Ajouté
- « 🧪 Essayer avec un exemple » : rapport et carnet fictifs (toitures dessinées) et visite guidée
  dans l'appli (driver.js) qui fait faire tout le parcours, des notes au PDF. Reprise et suppression
  de l'exemple depuis le menu de gauche ; badge « Exemple » dans la liste des rapports.
- Visite guidée sur téléphone : « 🧪 Découvrir en 1 minute » (Notes terrain, Guide) fait créer
  un carnet d'essai, prendre une note et montre l'export.
- Tutoriel pour une première utilisation :
  - carte « Première fois ? » sur l'accueil (parcours en 5 étapes, masquable) ;
  - page « Guide » (menu de gauche, et lien depuis Notes terrain sur téléphone) ;
  - bandeaux « À quoi sert cet écran » sur Notes terrain, Photos & annotations, Photos terrain,
    Rattacher les notes et Aperçu PDF. « Masquer » est retenu dans le navigateur ; le guide permet de tout réafficher.
  - captures annotées dans le guide (repères numérotés + légende), téléphone et ordinateur,
    générées par `npm run captures` à partir de données fictives.
- Accueil : un carnet de notes terrain s'importe aussi depuis « Importer un rapport ou un carnet ».
  Il peut servir de début de rapport : bâtiment (titre du carnet), date (première note),
  adresse proche du GPS (Base Adresse Nationale, à vérifier), carnet déjà lié pour le rattachement.

### Corrigé
- L'import d'un carnet depuis l'accueil affichait « Ce fichier n'est pas un rapport DroneReport ».

## [1.0.0] - 2026-11-26 — édition collectivité

Dérivée de DroneReport 0.1.0 (version SaaS).

### Ajouté
- Mode terrain mobile : carnets de notes horodatées (texte, gravité, GPS), hors ligne, export .json.
- Lecture EXIF / XMP des photos drone (heure, GPS, hauteur).
- Rattachement des notes aux photos par l'heure, décalage d'horloge réglable ou estimé, choix manuel.
- Champs collectivité : bâtiment, réf. patrimoine, service demandeur, exploitant, télépilote,
  catégorie de vol, déclaration préfecture, éléments contrôlés.
- Export / import d'un rapport complet en .json.
- Publication GitHub Pages (workflow Actions).

### Retiré
- Paiement Stripe, abonnements, quotas, comptes Supabase, stockage cloud, liens de partage.
- Landing page, bandeau cookies, analytics (PostHog, Vercel).
