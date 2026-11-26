# Changelog

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
