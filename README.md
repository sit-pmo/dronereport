# DroneReport — édition collectivité

Outil interne du service SIT (PETR Marennes Oléron, futur SyMONT) pour produire
des rapports d'inspection de toiture par drone. Dérivé de DroneReport, sans
paiement, sans compte et sans serveur.

En ligne : https://sit-pmo.github.io/dronereport-collectivite/

## Principe : les données restent sur le poste

- Rapports, photos et notes sont stockés dans le navigateur (IndexedDB).
- Rien n'est envoyé sur un serveur. Seules requêtes externes : le géocodage de
  l'adresse (api-adresse.data.gouv.fr) et les fonds de carte IGN pour le plan de situation.
- Pour changer de poste ou passer un rapport à un collègue : **exporter en .json**, puis importer.
- Vider le cache du navigateur efface les données : exporter régulièrement.

Données rouges (nominatives, MAJIC, etc.) : ne pas les saisir dans l'outil.

## Parcours

1. **Sur le terrain (téléphone)** — ouvrir l'adresse, « Notes terrain ».
   Un carnet par mission. Chaque note enregistre l'heure et, si autorisé, le GPS
   du téléphone. Le micro du clavier permet de dicter. Fonctionne hors réseau
   une fois la page ouverte une première fois (l'ajouter à l'écran d'accueil).
   À la fin : « Exporter » → envoyer le fichier .json (mail, Teams…).
2. **Au bureau (PC)** — « Nouveau rapport » → infos mission → plan de situation
   → importer les photos du drone (**fichiers d'origine**, pour garder l'heure et le GPS).
3. **Rattacher les notes terrain** : importer le carnet. Chaque note est proposée
   sur la photo la plus proche dans le temps. Corriger si besoin (décalage
   d'horloge du drone, choix manuel). Valider : les notes deviennent des points
   au centre des photos, à déplacer sur le défaut dans l'éditeur.
4. Annoter, vérifier l'aperçu, télécharger le PDF.

## Développement (Windows / PowerShell)

```powershell
npm ci
npm run dev      # http://localhost:5173/dronereport-collectivite/
npm test
npm run build
```

Publication automatique sur GitHub Pages à chaque push sur `main`
(`.github/workflows/deploy.yml`).

## Fichiers clés

- `src/lib/idbStore.ts` : stockage IndexedDB.
- `src/lib/reportDraft.ts` : rapports (cache mémoire + IndexedDB).
- `src/lib/notesTerrain.ts` : carnets de notes terrain, export / import.
- `src/lib/photoMeta.ts` : lecture EXIF / XMP des photos drone (bibliothèque exifr).
- `src/lib/rattachement.ts` : rattachement notes → photos (heure, puis GPS pour départager).
- `src/pages/NotesTerrain.tsx`, `src/pages/RattacherNotes.tsx` : écrans associés.
- `public/sw.js` : mode hors ligne.
