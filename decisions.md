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
