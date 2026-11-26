import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MissionInfos, InspectionType, RoofMaterial, Exploitant, CategorieVol } from '../types'
import { saveDraft, updateDraftMission, savePiloteLogo, loadPiloteLogo, clearPiloteLogo, savePiloteCompany, loadPiloteCompany } from '../lib/reportDraft'
import { INSPECTION_LABELS, ROOF_MATERIAL_LABELS, EXPLOITANT_LABELS, CATEGORIE_VOL_LABELS, POINTS_CONTROLE_TOITURE } from '../lib/constants'
import { useDraft } from '../hooks/useDraft'
import { downscaleLogo, blobToDataUrl } from '../lib/imageUtils'

const METEO_OPTIONS = ['Ensoleillé', 'Nuageux', 'Couvert', 'Vent fort', 'Pluie légère']
const INSPECTION_TYPES: InspectionType[] = ['toiture', 'photovoltaique']
const EXPLOITANTS = Object.keys(EXPLOITANT_LABELS) as Exploitant[]
const CATEGORIES = Object.keys(CATEGORIE_VOL_LABELS) as CategorieVol[]
const ROOF_MATERIALS: RoofMaterial[] = ['tuile', 'ardoise', 'terrasse', 'bac_acier', 'vegetalisee', 'plaques_sous_tuiles']

const MAT_SUFFIX: Record<RoofMaterial, string> = {
  tuile: 'en tuile',
  ardoise: 'en ardoise',
  terrasse: 'terrasse',
  bac_acier: 'en bac acier',
  vegetalisee: 'végétalisée',
  plaques_sous_tuiles: 'en plaques sous tuiles',
}

function buildAutoObjet(f: MissionInfos): string {
  const base = f.typeInspection === 'photovoltaique'
    ? "Inspection thermique de l'installation photovoltaïque"
    : `Inspection visuelle de la toiture${f.materiauToiture ? ' ' + MAT_SUFFIX[f.materiauToiture] : ''}`
  const lieu = [f.batiment?.trim(), f.adresse.trim()].filter(Boolean).join(', ')
  return lieu ? `${base} — ${lieu}` : base
}

const EMPTY_FORM: MissionInfos = {
  clientNom: '',
  clientEmail: '',
  adresse: '',
  date: new Date().toISOString().split('T')[0],
  typeInspection: 'toiture',
  materiauToiture: 'tuile',
  meteo: 'Ensoleillé',
  drone: '',
  notes: '',
  categorieVol: 'A2',
  pointsControle: [],
}

export default function InfosMission() {
  const navigate = useNavigate()
  const { draft, setDraft } = useDraft()
  const [form, setForm] = useState<MissionInfos>(EMPTY_FORM)
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined)
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [logoLoading, setLogoLoading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const objetManuallyEdited = useRef(false)

  useEffect(() => {
    if (draft?.mission) {
      setForm({ ...EMPTY_FORM, ...draft.mission })
      objetManuallyEdited.current = !!draft.mission.objetMission
    }
    setLogoDataUrl(draft?.logoDataUrl ?? loadPiloteLogo() ?? undefined)
    setNomEntreprise(draft?.nomEntreprise ?? loadPiloteCompany() ?? '')
  }, [draft?.sessionUuid])

  useEffect(() => {
    if (!objetManuallyEdited.current) {
      setForm(prev => ({ ...prev, objetMission: buildAutoObjet(prev) }))
    }
  }, [form.typeInspection, form.materiauToiture, form.adresse, form.batiment])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoLoading(true)
    try {
      const blob = await downscaleLogo(file)
      const dataUrl = await blobToDataUrl(blob)
      setLogoDataUrl(dataUrl)
    } finally {
      setLogoLoading(false)
      // Reset input so the same file can be re-selected
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  function handleLogoClear() {
    setLogoDataUrl(undefined)
    clearPiloteLogo()
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  function set<K extends keyof MissionInfos>(key: K, value: MissionInfos[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return

    const withMission = updateDraftMission(draft, form)

    if (logoDataUrl) savePiloteLogo(logoDataUrl)
    if (nomEntreprise.trim()) savePiloteCompany(nomEntreprise.trim())
    const final = { ...withMission, logoDataUrl, nomEntreprise: nomEntreprise.trim() || undefined }
    saveDraft(final)
    setDraft(final)
    navigate('/photos')
  }

  // Champs obligatoires : bâtiment, demandeur, adresse, drone, télépilote
  const isValid = !!form.batiment?.trim() && form.clientNom.trim() !== '' && form.adresse.trim() !== '' && form.drone.trim() !== '' && !!form.telepilote?.trim()

  return (
    <main style={s.main}>
      <h1 style={s.title}>Informations mission</h1>

      <form onSubmit={handleSubmit}>
        <Field label="Bâtiment inspecté *" id="batiment">
          <input
            id="batiment"
            style={s.input}
            value={form.batiment ?? ''}
            onChange={(e) => set('batiment', e.target.value)}
            placeholder="Gymnase municipal, école Jules-Ferry…"
          />
        </Field>

        <Field label="Référence patrimoine (optionnel)" id="refPatrimoine">
          <input
            id="refPatrimoine"
            style={s.input}
            value={form.refPatrimoine ?? ''}
            onChange={(e) => set('refPatrimoine', e.target.value)}
            placeholder="Identifiant dans l'inventaire du patrimoine bâti"
          />
        </Field>

        <Field label="Service demandeur *" id="clientNom">
          <input
            id="clientNom"
            style={s.input}
            value={form.clientNom}
            onChange={(e) => set('clientNom', e.target.value)}
            placeholder="Services techniques de la commune de…"
            autoComplete="organization"
          />
        </Field>

        <Field label="Contact du demandeur (optionnel)" id="clientEmail">
          <input
            id="clientEmail"
            style={s.input}
            type="email"
            value={form.clientEmail}
            onChange={(e) => set('clientEmail', e.target.value)}
            placeholder="adresse mail professionnelle du service"
            autoComplete="email"
          />
        </Field>

        <Field label="Adresse du site *" id="adresse">
          <input
            id="adresse"
            style={s.input}
            value={form.adresse}
            onChange={(e) => set('adresse', e.target.value)}
            placeholder="Rue des Écoles, 17310 Saint-Pierre-d'Oléron"
          />
        </Field>

        <Field label="Date d'inspection" id="dateInspection">
          <input
            id="dateInspection"
            style={s.input}
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </Field>

        <Field label="Type d'inspection">
          <div style={s.chips}>
            {INSPECTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('typeInspection', t)}
                style={{ ...s.chip, ...(form.typeInspection === t ? s.chipOn : {}) }}
              >
                {INSPECTION_LABELS[t]}
              </button>
            ))}
          </div>
        </Field>

        {form.typeInspection === 'toiture' && (
          <Field label="Matériau de couverture">
            <div style={s.chips}>
              {ROOF_MATERIALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set('materiauToiture', m)}
                  style={{ ...s.chip, ...(form.materiauToiture === m ? s.chipOn : {}) }}
                >
                  {ROOF_MATERIAL_LABELS[m]}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Conditions météo">
          <div style={s.chips}>
            {METEO_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set('meteo', m)}
                style={{ ...s.chip, ...(form.meteo === m ? s.chipOn : {}) }}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Drone utilisé *" id="drone">
          <input
            id="drone"
            style={s.input}
            value={form.drone}
            onChange={(e) => set('drone', e.target.value)}
            placeholder="DJI Matrice 4E, Air 3, Mini 5 Pro…"
          />
        </Field>

        <Field label="Télépilote *" id="telepilote">
          <input
            id="telepilote"
            style={s.input}
            value={form.telepilote ?? ''}
            onChange={(e) => set('telepilote', e.target.value)}
            placeholder="Prénom Nom"
          />
        </Field>

        <Field label="Exploitant UAS">
          <div style={s.chips}>
            {EXPLOITANTS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => {
                  set('exploitant', x)
                  // Pré-remplit le nom de structure affiché dans l'en-tête du PDF
                  if (!nomEntreprise.trim() && x !== 'autre') setNomEntreprise(EXPLOITANT_LABELS[x])
                }}
                style={{ ...s.chip, ...(form.exploitant === x ? s.chipOn : {}) }}
              >
                {EXPLOITANT_LABELS[x]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Catégorie de vol">
          <div style={s.chips}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('categorieVol', c)}
                style={{ ...s.chip, ...(form.categorieVol === c ? s.chipOn : {}) }}
              >
                {CATEGORIE_VOL_LABELS[c]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Déclaration préfecture (si vol en agglomération)" id="cerfaRef">
          <input
            id="cerfaRef"
            style={s.input}
            value={form.cerfaRef ?? ''}
            onChange={(e) => set('cerfaRef', e.target.value)}
            placeholder="Cerfa 15476*04 envoyé le …"
          />
        </Field>

        {form.typeInspection === 'toiture' && (
          <Field label="Éléments contrôlés">
            <div style={s.chips}>
              {POINTS_CONTROLE_TOITURE.map((pt) => {
                const on = form.pointsControle?.includes(pt) ?? false
                return (
                  <button
                    key={pt}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('pointsControle', on
                      ? (form.pointsControle ?? []).filter((x) => x !== pt)
                      : [...(form.pointsControle ?? []), pt])}
                    style={{ ...s.chip, ...(on ? s.chipOn : {}) }}
                  >
                    {on ? '✓ ' : ''}{pt}
                  </button>
                )
              })}
            </div>
          </Field>
        )}

        <Field label="Objet de la mission" id="objetMission">
          <textarea
            id="objetMission"
            style={{ ...s.input, minHeight: 80, resize: 'vertical' }}
            value={form.objetMission ?? ''}
            onChange={(e) => {
              objetManuallyEdited.current = true
              set('objetMission', e.target.value)
            }}
            placeholder="Inspection visuelle de la toiture par drone suite à signalement de désordres…"
          />
        </Field>

        <Field label="Méthodologie d'intervention" id="methodologie">
          <textarea
            id="methodologie"
            style={{ ...s.input, minHeight: 80, resize: 'vertical' }}
            value={form.methodologie ?? ''}
            onChange={(e) => set('methodologie', e.target.value)}
            placeholder="Vol orbital à 30 m d'altitude, prise de vue nadir + oblique, orthophoto générée par…"
          />
        </Field>

        <Field label="Notes (optionnel)" id="notes">
          <textarea
            id="notes"
            style={{ ...s.input, minHeight: 80, resize: 'vertical' }}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Accès difficile côté nord, végétation dense…"
          />
        </Field>

        <Field label="Logo & structure (optionnel)">
          <div style={s.logoZone}>
            <div style={s.logoRow}>
              {logoDataUrl ? (
                <div style={s.logoPreview}>
                  <img src={logoDataUrl} alt="Logo" style={s.logoImg} />
                  <button type="button" onClick={handleLogoClear} style={s.logoRemove} aria-label="Supprimer le logo">
                    ✕
                  </button>
                </div>
              ) : (
                <label style={{ ...s.logoUpload, ...(logoLoading ? s.logoUploadLoading : {}) }}>
                  {logoLoading ? 'Traitement…' : '+ Logo'}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoChange}
                    style={{ display: 'none' }}
                    disabled={logoLoading}
                  />
                </label>
              )}
              <input
                style={{ ...s.input, flex: 1 }}
                value={nomEntreprise}
                onChange={(e) => setNomEntreprise(e.target.value)}
                placeholder="Nom de la structure (ex. CC de l'île d'Oléron)"
              />
            </div>
            <p style={s.logoHint}>Logo PNG/JPEG + nom affichés en en-tête du rapport PDF</p>
          </div>
        </Field>

        <button
          type="submit"
          disabled={!isValid}
          style={{ ...s.cta, ...(!isValid ? s.ctaOff : {}) }}
        >
          Continuer → Photos & annotations
        </button>
      </form>
    </main>
  )
}

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={s.label}>{label}</label>
      {children}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: { padding: '48px 40px 48px', maxWidth: 680, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 32, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.01em' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#5a7083', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', padding: '12px 14px', border: '1.5px solid #dde1e6', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '10px 16px', borderRadius: 20, border: '1.5px solid #dde1e6', background: '#fff', cursor: 'pointer', fontSize: 14, minHeight: 44, fontFamily: 'inherit', color: '#374151' },
  chipOn: { background: '#1a2e44', border: '1.5px solid #1a2e44', color: '#fff' },
  cta: { marginTop: 36, width: '100%', background: '#1a2e44', color: '#fff', padding: '16px 24px', borderRadius: 10, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: 52, fontFamily: 'inherit' },
  ctaOff: { background: '#d1d5db', cursor: 'not-allowed' },
  logoZone: { display: 'flex', flexDirection: 'column', gap: 8 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10 },
  logoPreview: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1.5px solid #dde1e6', borderRadius: 8, background: '#fff', flexShrink: 0 },
  logoImg: { height: 36, maxWidth: 120, objectFit: 'contain', display: 'block' },
  logoRemove: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: 4, lineHeight: 1 },
  logoUpload: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', border: '1.5px dashed #dde1e6', borderRadius: 8, fontSize: 14, color: '#5a7083', cursor: 'pointer', background: '#fafafa', minHeight: 44, flexShrink: 0, whiteSpace: 'nowrap' },
  logoUploadLoading: { color: '#9ca3af', cursor: 'default' },
  logoHint: { margin: 0, fontSize: 12, color: '#9ca3af' },
}
