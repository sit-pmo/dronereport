# Changelog

## [Non publié]

### Ajouté
- Tutoriel pour une première utilisation :
  - carte « Première fois ? » sur l'accueil (parcours en 5 étapes, masquable) ;
  - page « Guide » (menu de gauche, et lien depuis Notes terrain sur téléphone) ;
  - bandeaux « À quoi sert cet écran » sur Notes terrain, Photos & annotations, Photos terrain,
    Rattacher les notes et Aperçu PDF. « Masquer » est retenu dans le navigateur ; le guide permet de tout réafficher.
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
