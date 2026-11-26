# Décisions

2026-11-26 | Version 100 % navigateur, sans SaaS (ni compte, ni paiement, ni serveur) | Usage interne, données de collectivité, pas de serveur à maintenir
2026-11-26 | Hébergement GitHub Pages, dépôt public sit-pmo/dronereport | Gratuit ; seul le code est public, les données restent dans le navigateur
2026-11-26 | Stockage IndexedDB, échanges entre postes par fichiers .json | localStorage limité à 5 Mo ; pas de cloud
2026-11-26 | Notes terrain sur téléphone rattachées aux photos par l'heure EXIF, GPS seulement pour départager | Le téléphone est au sol, à des dizaines de mètres du drone
2026-11-26 | Décalage d'horloge drone réglable et estimable | DateTimeOriginal DJI = heure locale sans fuseau, horloge parfois fausse (forums DJI)
2026-11-26 | Pas de photo prise au téléphone dans les notes | Le défaut de toiture n'est visible que du drone
2026-11-26 | Conclusion rédigée par IA (Haiku) retirée | Les données sortiraient de Claude Team
2026-11-26 | DESIGN.md réduit à la charte graphique | Dépôt public : retirer la stratégie commerciale du SaaS
2026-11-26 | L'import de l'accueil accepte aussi un carnet de notes terrain et propose d'en faire un début de rapport | Les utilisateurs importaient le carnet au mauvais endroit et recevaient « ce n'est pas un rapport »
2026-11-26 | Adresse du rapport suggérée par géocodage inverse de la Base Adresse Nationale, à partir du GPS le plus précis du carnet (≤ 150 m) | Service public déjà utilisé pour le plan de situation ; seules les coordonnées sont envoyées, jamais le texte des notes ; l'adresse reste à vérifier
2026-11-26 | Tutoriel intégré sans bibliothèque : carte d'accueil, page Guide, bandeaux par écran, « Masquer » retenu en localStorage | Solution légère ; pas de visite guidée pas à pas ; exemple fictif écarté pour l'instant (photos publiables à trouver)
2026-11-26 | Guide illustré par captures annotées générées par script (Playwright), plutôt qu'une visite guidée dans l'appli | Captures à jour en une commande ; une visite guidée casse dès qu'un bouton bouge et demanderait un rapport d'exemple
2026-11-26 | Captures produites avec des données fictives uniquement (photos de toiture dessinées, adresse et plan fictifs, services extérieurs simulés) | Dépôt public : aucune donnée réelle ni de collectivité dans les images
2026-11-26 | Visite guidée dans l'appli avec driver.js (MIT, sans dépendance, version 1.11.0 de plus de 2 semaines), chargée à la demande | Robuste (attente des éléments entre écrans, avance au clic) pour un coût minime ; rien à charger tant qu'on ne lance pas la visite
2026-11-26 | Rapport d'exemple fictif (« Essayer avec un exemple ») : adresse limitée à la commune, photos dessinées servies par le site | Apprendre en faisant, sans drone ; aucune donnée réelle dans le dépôt public
2026-11-26 | Visite guidée limitée à l'ordinateur ; la prise de notes au téléphone reste expliquée par le Guide | Les écrans rapport sont réservés au PC ; le carnet de l'exemple remplace la phase téléphone
2026-11-26 | Visite guidée téléphone sur un carnet d'essai créé par l'utilisateur (pas de carnet d'exemple pré-rempli) | Sur le terrain, le geste à apprendre est la saisie elle-même ; le carnet d'essai se supprime avec 🗑
