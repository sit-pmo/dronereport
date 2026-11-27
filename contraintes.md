# Contraintes

- Données rouges (nominatives, MAJIC…) interdites dans l'outil, même en local.
- Vider le cache du navigateur efface rapports et carnets : exporter en .json.
- Photos à importer en fichiers d'origine (une photo passée par une messagerie perd l'heure et le GPS).

## À vérifier

- [ ] Lecture EXIF/XMP sur une vraie photo DJI (Matrice 4E, Air 3, Mini 5 Pro)
- [ ] Prise de notes sur un vrai téléphone, hors réseau, écran au soleil
- [ ] Export du carnet via « Partager » sur Android et iOS
- [ ] Plan de situation IGN depuis GitHub Pages (tuiles et géocodage)
- [ ] Rapport créé depuis un carnet : adresse BAN trouvée en ligne et pertinente (GPS téléphone souvent à ~100 m)
- [ ] Visite guidée de l'exemple sur un vrai poste Windows (Chrome / Edge), avec plan IGN réel
- [ ] Visite guidée terrain sur un vrai téléphone (Android et iOS) : clavier ouvert, bulle lisible
- [ ] Exemple sur un poste hors fuseau de Paris : notes décalées de l'heure (attendu, réglable par le décalage)

## À trancher

- [ ] Titulaire des droits d'auteur à inscrire (en-tête de licence, README) : le code reprend
  l'ancienne version SaaS (dépôt privé personnel) ; PETR/SyMONT, auteur, ou les deux ? À confirmer
  avant d'ajouter une mention « Copyright ».
- [ ] Texte de `LICENSE` repris de la liste SPDX (gnu.org bloqué depuis la session) : contenu identique,
  paragraphes sur une ligne. Remplaçable par https://www.gnu.org/licenses/agpl-3.0.txt si on préfère.
- [ ] Les notes du téléphone ne se rattachent qu'au parcours « sans ortho » (Photos terrain). Avec une ortho, pas de rattachement possible : voulu ou à ajouter ?
- [ ] Numéro de version : `package.json` indique 0.1.0, le CHANGELOG et AGENTS.md parlent de 1.0.0.
