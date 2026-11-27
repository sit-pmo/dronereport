# DESIGN.md — charte graphique

Charte visuelle de DroneReport.

## Design System Visuel

Généré par /design-consultation le 2026-05-26 — **APPROUVÉ 2026-05-26**
Direction mémorable : "Le PDF inspire confiance de cabinet. L'app se remplit à toute vitesse, un doigt, tête baissée sur le toit."

### Aesthetic Direction

**Instrument de précision**
Ni froid high-tech, ni startup-cute. Comme un bon outil de mesure français : fiable, sobre, expert.
Le commanditaire ouvre le PDF et dit "a été fait par un professionnel".
Le pilote déroule le formulaire sans réfléchir.

- Decoration level: minimal — la typographie fait le travail
- Layout: grid-disciplined, mobile-first
- Reference: cadastre, rapport de cabinet notarial, instruments de mesure industriels

### Typographie

| Rôle | Police | Usage |
|------|--------|-------|
| Display / Titres d'étapes | Instrument Sans 600–700 | Titres de step, noms de zones, hero landing |
| UI / Corps / Boutons | DM Sans 400–600 | Labels de champs, boutons, descriptions d'anomalies |
| Données techniques | Geist Mono | GPS, dates, références d'anomalies (PAN-N-001), dimensions |
| PDF corps (react-pdf) | Noto Sans | Tout le contenu du PDF — support accents français garanti |

**Chargement :** Bunny Fonts (RGPD-compatible, pas Google Fonts)
```html
<link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700|dm-sans:400,500,600&display=swap" rel="stylesheet" />
```
Geist Mono : `https://fonts.bunny.net/css?family=geist-mono:400,500`

**Échelle typographique :**
| Niveau | Taille | Poids | Utilisation |
|--------|--------|-------|-------------|
| Hero | 22px | 700 | Landing claim |
| Step title | 18px | 600 | Titre d'étape dans le header |
| Section | 16px | 600 | Titres de section dans le formulaire |
| Body | 15px | 400 | Descriptions d'anomalies, texte courant |
| Label | 12px | 600 | Labels de champs (uppercase, letter-spacing .05em) |
| Caption | 11px | 500 | Métadonnées, références, timestamps |

### Palette de couleurs

```css
:root {
  /* Fond & surfaces */
  --bg:           #f8f7f4;  /* blanc-papier chaud — pas le blanc froid d'écran */
  --surface:      #ffffff;

  /* Principal */
  --navy:         #1a2e44;  /* marine profond — documents officiels, expertise */
  --navy-hover:   #243d59;

  /* Texte */
  --text:         #0f1a25;  /* presque noir, teinté marine */
  --muted:        #5a7083;  /* gris bleu-froid */

  /* Accent */
  --accent:       #c07828;  /* bronze-ambre — tampon de certification */
  --accent-bg:    #fef3e2;

  /* Bordures & ombres */
  --border:       #dde1e6;
  --shadow-sm:    0 1px 3px rgba(15,26,37,.08);
  --shadow-md:    0 4px 12px rgba(15,26,37,.10);

  /* Sémantiques */
  --success:      #1a7a4a;
  --success-bg:   #e8f5ee;

  /* Échelle de sévérité (du moins au plus grave) */
  --faible:       #9ca3af;  /* gris neutre */
  --faible-bg:    #f9fafb;
  --moderate:     #5a7083;  /* bleu-gris */
  --moderate-bg:  #f1f4f7;
  --grave:        #c07828;  /* ambre-bronze (= accent) — "sérieux sans paniquer" */
  --grave-bg:     #fef3e2;
  --critique:     #b91c1c;  /* rouge sombre — RÉSERVÉ à Critique uniquement */
  --critique-bg:  #fee2e2;

  /* Polices */
  --font-display: 'Instrument Sans', sans-serif;
  --font-body:    'DM Sans', sans-serif;
  --font-mono:    'Geist Mono', 'JetBrains Mono', ui-monospace, monospace;
}
```

**Règle sévérité :** Rouge (`--critique`) est exclusivement réservé au niveau Critique.
L'ambre (`--grave`) pour Grave = le commanditaire lit "situation sérieuse" sans associer à une alarme d'urgence.

### Espacement

- **Unité de base :** 8px
- **Densité :** comfortable (mobile-first, 44px minimum sur tous les éléments interactifs)
- **Échelle :** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64

### Layout

- **Approche :** grid-disciplined, une colonne
- **Max width mobile :** 480px (plein écran sur téléphone)
- **Max width desktop :** 640px (formulaire centré)
- **Border-radius :**
  - `--r-sm: 6px` — chips de sévérité, badges
  - `--r-md: 10px` — champs, boutons, cards
  - `--r-lg: 14px` — zone-cards, modales
- **Progress indicator :** 6 segments linéaires dans le topbar (navy fond, blanc actif, ambre complété)

### Motion

- **Approche :** minimal-fonctionnel — seulement ce qui aide à comprendre
- **Transitions d'étapes :** 200ms ease-out (slide horizontal ou fade)
- **Spinners :** bouton "Analyse en cours..." + cercle rotatif pendant appel Haiku
- **États de chargement :** barre de progression par photo (linéaire, navy fill)
- Pas d'animation décorative. Pas d'effets d'entrée génériques.

### Choix sûrs (la catégorie les attend)

- Layout une colonne sur mobile — pilote, un pouce, toit
- Marine foncé pour l'action primaire — courant dans le B2B français
- Progress indicator linéaire 6 étapes — attendu sur formulaires multi-étapes

### Risques assumés (c'est là que DroneReport a sa tête à lui)

1. **Fond blanc-papier chaud (#f8f7f4)** au lieu du blanc froid standard.
   Fait le lien visuel entre l'app et le PDF papier. Cohérence app↔document.

2. **Accent ambre-bronze (#c07828) pour sévérité Grave**, pas rouge/orange habituel.
   Le commanditaire lit "situation sérieuse" sans paniquer. Le rouge reste exclusif au Critique.

3. **Instrument Sans + Geist Mono** — aucun concurrent dans ce créneau ne les utilise.
   Double sens sur "Instrument" = outil de mesure = drone inspection. Identité mémorable.

### Log

| Date | Décision | Notes |
|------|----------|-------|
| 2026-05-26 | Design system initial créé | /design-consultation — direction "Instrument de précision" |
