/**
 * Captures annotées du guide.
 *
 * Joue le vrai parcours dans l'application (téléphone puis ordinateur) avec des
 * données FICTIVES, pose des repères numérotés sur les éléments décrits dans
 * src/lib/guideCaptures.json, et enregistre les images dans public/guide/.
 *
 * Données utilisées :
 * - carnet tapé dans l'appli, heure et GPS simulés (Saint-Pierre-d'Oléron, approximatif) ;
 * - photos de toiture DESSINÉES (public/exemple/, générées par photos_exemple.py) ;
 * - Base Adresse Nationale et tuiles IGN remplacées par des réponses fictives :
 *   le script ne contacte aucun service extérieur.
 *
 * Usage (PowerShell) :
 *   npx playwright install chromium   # une seule fois par poste
 *   npm run captures                  # build + captures
 */
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'
import { preview } from 'vite'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EXEMPLE = join(RACINE, 'scripts', 'guide', 'exemple') // plan fictif
const PHOTOS = join(RACINE, 'public', 'exemple') // photos dessinées, aussi servies par le site
const SORTIE = join(RACINE, 'public', 'guide')
const { captures } = JSON.parse(await readFile(join(RACINE, 'src', 'lib', 'guideCaptures.json'), 'utf8'))
const PAR_ID = Object.fromEntries(captures.map((c) => [c.id, c]))

// Position fictive du téléphone (centre de Saint-Pierre-d'Oléron, approximatif)
const GPS = { latitude: 45.9421, longitude: -1.3059, accuracy: 12 }
// Notes du carnet d'exemple : ~20 s après chaque photo d'exemple (heure de Paris, été = UTC+2)
const NOTES = [
  { heureUtc: '2026-08-14T08:02:30Z', texte: 'Tuile cassée côté rue', gravite: 'Grave' },
  { heureUtc: '2026-08-14T08:05:50Z', texte: 'Mousse sur le pan nord', gravite: 'Modéré' },
  { heureUtc: '2026-08-14T08:09:20Z', texte: 'Gouttière déboîtée', gravite: 'Grave' },
]
// Toutes les aides masquées : captures plus lisibles (les bandeaux sont décrits dans le guide)
const AIDES = ['accueil-decouverte', 'notes-terrain', 'photos', 'photos-terrain', 'rattacher-notes', 'apercu-pdf']

/** Trouve l'élément visé par un repère. */
function cible(page, c) {
  const el = c.css ? page.locator(c.css).first() : page.getByText(c.texte, { exact: false }).first()
  // « parent » : encadrer le bloc qui contient le libellé (barre d'outils, liste…).
  // true = un niveau ; un nombre = autant de niveaux.
  const niveaux = c.parent === true ? 1 : (c.parent ?? 0)
  return niveaux ? el.locator(Array(niveaux).fill('..').join('/')) : el
}

/**
 * Pose les repères de la capture `id` (cadre + pastille numérotée), prend
 * l'image, puis retire les repères. `clip` limite la zone capturée.
 */
async function capturer(page, id, { clip } = {}) {
  const def = PAR_ID[id]
  if (!def) throw new Error(`Capture inconnue : ${id}`)
  const boites = []
  for (const r of def.reperes) {
    const loc = cible(page, r.cible)
    await loc.waitFor({ state: 'visible', timeout: 10000 })
    const b = await loc.boundingBox()
    if (!b) throw new Error(`${id} : repère ${r.n} introuvable`)
    boites.push({ n: r.n, position: r.position ?? 'gauche', ...b })
  }
  // Calque posé en position fixe par-dessus la page (couleurs de la charte : accent bronze)
  // Bord gauche de la zone capturée : une pastille ne doit pas sortir de l'image
  const bordGauche = (clip?.x ?? 0) + 4
  await page.evaluate(({ boites, bordGauche }) => {
    const calque = document.createElement('div')
    calque.id = 'calque-guide'
    calque.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999'
    for (const b of boites) {
      const cadre = document.createElement('div')
      cadre.style.cssText = `position:absolute;left:${b.x - 4}px;top:${b.y - 4}px;width:${b.width + 8}px;height:${b.height + 8}px;border:3px solid #c07828;border-radius:8px;box-shadow:0 0 0 3px rgba(255,255,255,.7)`
      const pastille = document.createElement('div')
      pastille.textContent = String(b.n)
      // Placement de la pastille :
      // « gauche » (défaut) : à gauche du cadre, centrée (au-dessus si la place manque) ;
      // « haut » : au-dessus du coin gauche ; « dedans » : dans le cadre, à droite ;
      // « bas » : sous le cadre, centrée.
      const aGauche = b.position === 'gauche' && b.x - 42 >= bordGauche
      let left = aGauche ? b.x - 42 : Math.max(bordGauche, b.x - 4)
      let top = aGauche ? b.y + b.height / 2 - 15 : Math.max(2, b.y - 40)
      if (b.position === 'dedans') {
        left = b.x + b.width - 40
        top = b.y + b.height / 2 - 15
      }
      if (b.position === 'bas') {
        // Sous le cadre, centrée
        left = b.x + b.width / 2 - 15
        top = b.y + b.height + 6
      }
      pastille.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:30px;height:30px;border-radius:50%;background:#c07828;color:#fff;font:700 16px/30px sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)`
      calque.append(cadre, pastille)
    }
    document.body.append(calque)
  }, { boites, bordGauche })
  await page.screenshot({ path: join(SORTIE, def.fichier), type: 'jpeg', quality: 80, clip })
  await page.evaluate(() => document.getElementById('calque-guide')?.remove())
  console.log('  ✓', def.fichier)
}

/** Remplace les services extérieurs par des réponses fictives. */
async function servicesFictifs(context) {
  const plan = await readFile(join(EXEMPLE, 'plan-fictif.png'))
  await context.route('https://api-adresse.data.gouv.fr/**', (route) => {
    const url = route.request().url()
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [GPS.longitude, GPS.latitude] },
      properties: { label: "Rue de l'Exemple 17310 Saint-Pierre-d'Oléron" },
    }
    route.fulfill({ json: { type: 'FeatureCollection', features: url.includes('/reverse/') || url.includes('/search/') ? [feature] : [] } })
  })
  await context.route('https://data.geopf.fr/**', (route) => route.fulfill({ body: plan, contentType: 'image/png' }))
  // Polices Bunny : on laisse passer si le réseau le permet, sinon police système
}

/** Masque les aides avant tout chargement de page. */
async function masquerAides(context) {
  await context.addInitScript((ids) => {
    try { localStorage.setItem('dronereport-aides-masquees', JSON.stringify(ids)) } catch { /* sans gravité */ }
  }, AIDES)
}

/** Zone utile d'un écran de téléphone : jusqu'au bas du contenu (évite le vide sous la page). */
async function zoneTelephone(page) {
  const vp = page.viewportSize()
  const bas = await page.evaluate(() => document.querySelector('main')?.getBoundingClientRect().bottom ?? innerHeight)
  return { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, Math.ceil(bas) + 8) }
}

// ── Téléphone : carnet de notes ──────────────────────────────────────────────

async function parcoursTelephone(browser, base, dossierTmp) {
  console.log('Téléphone')
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    deviceScaleFactor: 2,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    geolocation: GPS,
    permissions: ['geolocation'],
    acceptDownloads: true,
  })
  await masquerAides(context)
  await servicesFictifs(context)
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date('2026-08-14T08:00:00Z'))
  await page.goto(base + '#/terrain')

  await page.locator("input[aria-label='Nom de la mission']").fill('Gymnase (exemple)')
  await capturer(page, 'tel-nouveau-carnet', { clip: await zoneTelephone(page) })
  await page.locator("button[type='submit']").click()

  // Une note par photo d'exemple, à l'heure simulée
  for (const n of NOTES) {
    await page.clock.setFixedTime(new Date(n.heureUtc))
    await page.locator('textarea').fill(n.texte)
    await page.getByRole('radio', { name: n.gravite }).click()
    await page.getByText('+ Ajouter la note').click()
    await page.getByText(n.texte, { exact: true }).last().waitFor()
  }
  // Une note en cours de saisie, pour montrer le champ rempli
  await page.locator('textarea').fill('Faîtage à surveiller')
  await capturer(page, 'tel-carnet', { clip: await zoneTelephone(page) })

  // Export : sans menu « Partager » en automatique, le navigateur télécharge le fichier
  const telechargement = page.waitForEvent('download')
  await page.getByText('Exporter', { exact: true }).click()
  const fichier = join(dossierTmp, 'carnet-exemple.json')
  await (await telechargement).saveAs(fichier)
  await context.close()
  return fichier
}

// ── Ordinateur : du carnet au PDF ────────────────────────────────────────────

async function parcoursOrdinateur(browser, base, carnet) {
  console.log('Ordinateur')
  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  })
  await masquerAides(context)
  await servicesFictifs(context)
  const page = await context.newPage()
  // Zone utile : sans le menu de gauche (220 px)
  const zone = (h = 820) => ({ x: 220, y: 0, width: 1060, height: h })

  await page.goto(base + '#/app')
  await page.locator('input[type=file]').setInputFiles(carnet)
  await capturer(page, 'pc-accueil-import', { clip: zone(620) })
  await page.getByText('Créer un rapport à partir de ce carnet').click()

  // Formulaire mission : champs pré-remplis + champs obligatoires fictifs
  await page.locator('#adresse').waitFor()
  await page.setViewportSize({ width: 1280, height: PAR_ID['pc-mission'].hauteur })
  await page.locator('#clientNom').fill('Services techniques (exemple)')
  await page.locator('#drone').fill('DJI (exemple)')
  await page.locator('#telepilote').fill('Télépilote (exemple)')
  await capturer(page, 'pc-mission', { clip: zone(PAR_ID['pc-mission'].hauteur) })
  await page.setViewportSize({ width: 1280, height: 820 })
  await page.locator("button[type='submit']").click()

  await page.getByText('Continuer sans ortho').waitFor()
  await capturer(page, 'pc-photos-choix', { clip: zone() })
  await page.getByText('Continuer sans ortho').click()

  await page.locator('.leaflet-container').waitFor()
  await page.waitForTimeout(800) // laisse les tuiles fictives s'afficher
  await capturer(page, 'pc-situation', { clip: zone() })
  await page.getByText('Capturer ce plan de situation').click()

  // Photos d'exemple (dessinées), lues comme de vraies photos : EXIF puis réduction
  await page.getByText('+ Ajouter des photos').waitFor()
  await page.locator('input[type=file][multiple]').setInputFiles([1, 2, 3].map((i) => join(PHOTOS, `toiture-exemple-${i}.jpg`)))
  await page.getByText('✏ Annoter').nth(2).waitFor({ timeout: 20000 })
  await capturer(page, 'pc-photos-terrain', { clip: zone() })
  await page.getByText('Rattacher les notes terrain').click()

  await page.getByText('Valider (').waitFor()
  await capturer(page, 'pc-rattacher', { clip: zone() })
  await page.getByText('Valider (').click()

  await page.getByText('✏ Annoter').first().click()
  await page.locator("[data-guide='canvas'] img").first().waitFor()
  await page.waitForTimeout(500)
  await capturer(page, 'pc-annoter', { clip: zone() })

  await page.getByText('← Retour').click()
  await page.setViewportSize({ width: 1280, height: PAR_ID['pc-apercu'].hauteur })
  await page.getByText("Générer l'aperçu PDF").click()
  await page.getByText('Télécharger le PDF').waitFor({ timeout: 20000 })
  await page.waitForTimeout(2500) // rendu de l'aperçu PDF
  await capturer(page, 'pc-apercu', { clip: zone(PAR_ID['pc-apercu'].hauteur) })
  await context.close()
}

// ── Lancement ────────────────────────────────────────────────────────────────

await mkdir(SORTIE, { recursive: true })
const dossierTmp = await mkdtemp(join(tmpdir(), 'guide-'))
// Sert le build (dist/) comme sur GitHub Pages, sur un port local
const serveur = await preview({ root: RACINE, preview: { port: 4321, strictPort: false } })
const base = serveur.resolvedUrls.local[0] // ex. http://localhost:4321/dronereport/
const browser = await chromium.launch({ channel: 'chromium', args: ['--lang=fr-FR'] })
try {
  const carnet = await parcoursTelephone(browser, base, dossierTmp)
  await parcoursOrdinateur(browser, base, carnet)
  console.log(`${captures.length} captures dans public/guide/`)
} finally {
  await browser.close()
  await serveur.close()
  await rm(dossierTmp, { recursive: true, force: true })
}
