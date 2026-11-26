# DroneReport, édition collectivité — instructions

Outil interne du SIT (PETR Marennes Oléron / SyMONT). Dépôt public : aucun secret, aucune donnée.

## Design

Lire `DESIGN.md` avant toute décision visuelle (palette, polices, espacements).
Les parties « produit / tarifs » de DESIGN.md concernent la version SaaS d'origine et ne s'appliquent pas ici.

## Contraintes d'architecture

1. Aucun serveur, aucun compte, aucun paiement : tout tourne dans le navigateur.
2. Données dans IndexedDB (`src/lib/idbStore.ts`). Jamais d'envoi de photo ou de note vers un service tiers.
3. Photos réduites à 1200 px / 200 Ko avant stockage et avant injection dans react-pdf.
4. Lire les métadonnées (EXIF/XMP) sur le fichier d'origine, avant réduction.
5. Routage en `HashRouter` et `base` Vite = `/dronereport-collectivite/` (GitHub Pages).
6. Échanges entre postes uniquement par fichiers .json (rapport ou carnet).
7. Code commenté, en français.
