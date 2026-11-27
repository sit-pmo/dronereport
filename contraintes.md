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
- [ ] Repères photos sur le plan IGN réel (testés seulement avec tuiles simulées) : GPS d'une vraie photo DJI,
  lisibilité des numéros quand les repères se chevauchent
- [ ] Exemple sur un poste hors fuseau de Paris : notes décalées de l'heure (attendu, réglable par le décalage)

## À trancher

- [x] Titulaire des droits d'auteur : PETR Marennes Oléron (code écrit par Aurélien Chaumet dans ses
  fonctions au PETR). Mention dans le README et `package.json`. À passer au nom du SyMONT au 01/01/2027.
- [ ] Accord écrit de la hiérarchie (DGS ou président) pour la publication sous AGPL.
- [ ] Texte de `LICENSE` repris de la liste SPDX (gnu.org bloqué depuis la session) : contenu identique,
  paragraphes sur une ligne. Remplaçable par https://www.gnu.org/licenses/agpl-3.0.txt si on préfère.
- [ ] Les notes du téléphone ne se rattachent qu'au parcours « sans ortho » (Photos terrain). Avec une ortho, pas de rattachement possible : voulu ou à ajouter ?
- [x] Emplacement des photos sur le plan de situation : ajouté (repères numérotés, déplaçables, dessinés
  à la capture du plan ; le GPS du drone sert de position de départ). Comparaison avec l'ancien dépôt SaaS non faite.
- [ ] Ordre des photos : la liste « Photos terrain » est triée par heure, le PDF (et donc les numéros de
  repère) suit l'ordre d'import. Trier aussi le PDF par heure ?
- [ ] Numéro de version : `package.json` indique 0.1.0, le CHANGELOG et AGENTS.md parlent de 1.0.0.
