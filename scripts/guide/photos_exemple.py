"""
Génère les photos d'exemple du guide : toitures DESSINÉES (aucune vraie photo),
avec des métadonnées EXIF imitant un drone DJI (heure de prise de vue, GPS).

Ces fichiers sont publics (dépôt GitHub) : aucune donnée réelle.
Coordonnées : centre-bourg de Saint-Pierre-d'Oléron, approximatif.

Usage (PowerShell, une seule fois ou pour régénérer) :
    python scripts/guide/photos_exemple.py
Nécessite Pillow (pip install pillow).
"""
from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageFilter

DOSSIER = Path(__file__).parent / "exemple"
LARGEUR, HAUTEUR = 1200, 900

# Heure « murale » du drone (sans fuseau), une photo toutes les ~3 min
PHOTOS = [
    ("toiture-exemple-1.jpg", "2026:08:14 10:02:10", "tuile"),
    ("toiture-exemple-2.jpg", "2026:08:14 10:05:40", "mousse"),
    ("toiture-exemple-3.jpg", "2026:08:14 10:09:05", "gouttiere"),
]
LAT, LON = 45.9420, -1.3060  # Saint-Pierre-d'Oléron (approximatif)


def dms(valeur: float):
    """Degrés décimaux -> (deg, min, sec), écrits en rationnels EXIF par Pillow."""
    v = abs(valeur)
    d = int(v)
    m = int((v - d) * 60)
    s = round(((v - d) * 60 - m) * 60, 2)
    return (float(d), float(m), s)


def dessiner_toit(defaut: str, graine: int) -> Image.Image:
    """Dessine un pan de toiture en tuiles vu du dessus, avec un défaut visible."""
    rnd = random.Random(graine)
    img = Image.new("RGB", (LARGEUR, HAUTEUR), (120, 120, 112))
    d = ImageDraw.Draw(img)
    # Rangées de tuiles canal, légères variations de teinte
    for y in range(60, HAUTEUR - 110, 34):
        decal = 0 if (y // 34) % 2 else 22
        for x in range(-40 + decal, LARGEUR, 44):
            t = rnd.randint(-14, 14)
            couleur = (176 + t, 92 + t // 2, 62 + t // 3)
            d.rounded_rectangle([x, y, x + 40, y + 32], radius=9, fill=couleur, outline=(140, 70, 48))
    # Faîtage en haut, gouttière en bas
    d.rectangle([0, 30, LARGEUR, 60], fill=(150, 78, 54))
    d.rectangle([0, HAUTEUR - 110, LARGEUR, HAUTEUR - 86], fill=(190, 190, 185))
    d.rectangle([0, HAUTEUR - 86, LARGEUR, HAUTEUR], fill=(90, 110, 80))  # pelouse
    # Le défaut de chaque photo
    if defaut == "tuile":  # tuile cassée / manquante
        d.polygon([(560, 380), (612, 372), (606, 410), (566, 420)], fill=(45, 40, 38))
        d.line([(556, 376), (620, 430)], fill=(60, 50, 45), width=4)
    elif defaut == "mousse":  # plaque de mousse
        for _ in range(260):
            cx, cy = rnd.gauss(700, 60), rnd.gauss(420, 40)
            r = rnd.randint(4, 12)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(70 + rnd.randint(0, 30), 105 + rnd.randint(0, 30), 50))
    else:  # gouttière déboîtée
        d.rectangle([380, HAUTEUR - 110, 560, HAUTEUR - 86], fill=(120, 120, 115))
        d.polygon([(560, HAUTEUR - 110), (640, HAUTEUR - 96), (640, HAUTEUR - 74), (560, HAUTEUR - 86)], fill=(175, 175, 170))
    return img.filter(ImageFilter.GaussianBlur(0.6))


def plan_fictif() -> Image.Image:
    """Plan de situation FICTIF (remplace les tuiles IGN pendant les captures du guide)."""
    img = Image.new("RGB", (512, 512), (236, 233, 224))
    d = ImageDraw.Draw(img)
    # Routes
    d.rectangle([0, 230, 512, 262], fill=(255, 255, 255))
    d.rectangle([300, 0, 326, 512], fill=(255, 255, 255))
    # Îlots bâtis
    rnd = random.Random(7)
    for x in range(10, 500, 70):
        for y in (20, 100, 160, 290, 360, 430):
            if 280 < x < 340:
                continue
            w, h = rnd.randint(30, 55), rnd.randint(30, 50)
            d.rectangle([x, y, x + w, y + h], fill=(205, 190, 175), outline=(170, 150, 135))
    # Espace vert
    d.ellipse([360, 300, 480, 400], fill=(196, 222, 180))
    return img


def main() -> None:
    DOSSIER.mkdir(exist_ok=True)
    for i, (nom, heure, defaut) in enumerate(PHOTOS):
        img = dessiner_toit(defaut, graine=i)
        exif = img.getexif()
        exif[0x010F] = "DJI"                 # Make
        exif[0x0110] = "Exemple (photo dessinee)"  # Model (EXIF : ASCII seulement, pas d accent)
        exif.get_ifd(0x8769)[0x9003] = heure  # DateTimeOriginal
        gps = exif.get_ifd(0x8825)
        # Petit déplacement du drone entre les photos
        lat, lon = LAT + i * 0.00008, LON + i * 0.00006
        gps[1], gps[2] = "N", dms(lat)
        gps[3], gps[4] = ("W" if lon < 0 else "E"), dms(lon)
        img.save(DOSSIER / nom, quality=82, exif=exif)
        print("écrit", DOSSIER / nom)
    plan_fictif().save(DOSSIER / "plan-fictif.png")
    print("écrit", DOSSIER / "plan-fictif.png")


if __name__ == "__main__":
    main()
