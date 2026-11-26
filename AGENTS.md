# DroneReport, édition collectivité

Outil interne du SIT (PETR Marennes Oléron / SyMONT) : notes terrain sur téléphone et rapports PDF d'inspection de toiture par drone. Dépôt public : aucun secret, aucune donnée.

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

## Commandes (PowerShell)

```powershell
npm ci
npm run dev      # http://localhost:5173/dronereport-collectivite/
npm test
npm run build
```

Publication : push sur `main` → GitHub Actions → https://sit-pmo.github.io/dronereport-collectivite/

## État au 2026-11-26

- Version 1.0.0 : dérivée du SaaS DroneReport (dépôt privé `aurelienchaumet/dronereport`), paiement et cloud retirés.
- Testée de bout en bout dans Chrome (mobile → PC → PDF) avec des photos factices au format DJI ; 31 tests unitaires.
- Pas encore testée avec une vraie photo DJI ni sur un vrai téléphone en vol.
