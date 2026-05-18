/**
 * Handler — Analyse de rentabilité solaire (Claude API)
 * POST /api/v1/analyse/rentabilite-solaire
 *
 * Input JSON :
 * {
 *   puissance_kwc:             number,   // ex: 36
 *   commune:                   string,   // ex: "Lamentin"
 *   departement:               string,   // ex: "971" (optionnel, défaut 971)
 *   type_toit:                 string,   // "tuiles" | "bac acier" | "terrasse beton"
 *   inclinaison_degres:        number,   // optionnel, défaut 15
 *   orientation:               string,   // optionnel, défaut "sud"
 *   consommation_annuelle_kwh: number,   // ex: 8000
 *   tarif_achat_edf_eur_kwh:   number,   // optionnel, défaut 0.18
 *   cout_installation_eur:     number,   // optionnel — si fourni, calcule ROI précis
 *   avec_batterie:             boolean,  // optionnel, défaut false
 *   structure_juridique:       string,   // optionnel: "particulier" | "entreprise" | "sci"
 * }
 *
 * Output : analyse complète production, revenus EDF OA 20 ans, IRR, payback, crédit d'impôt 244W
 */

const SYSTEM_PROMPT = `Tu es un expert en énergie solaire photovoltaïque dans les DOM français (Zones Non Interconnectées — ZNI), spécialisé sur la Guadeloupe (971), la Martinique (972), La Réunion (974) et Mayotte (976).

Tu maîtrises parfaitement :
- Les tarifs EDF Obligation d'Achat (OA) en ZNI : environ 0,18 €/kWh sur 20 ans
- Le gisement solaire tropical : 1 400 à 1 600 kWh/kWc/an en Guadeloupe selon orientation
- Le crédit d'impôt Article 244 quater W CGI : 38,25% du coût HT pour les entreprises
- Les procédures de raccordement EDF SEI spécifiques aux DOM
- Les contraintes cycloniques (structure, certification)
- Les économies d'autoconsommation vs injection réseau

Règles de réponse :
- Toujours structurer en JSON valide (pas de markdown, pas de texte hors JSON)
- Inclure un champ "disclaimer" avec les hypothèses et limites du calcul
- Arrondir les montants à 2 décimales
- Indiquer clairement les hypothèses utilisées pour les paramètres non fournis
- Si une donnée est manquante, utiliser les valeurs typiques DOM et l'indiquer`;

export async function handleAnalyse(request, env) {
  // Lire le body JSON
  let input;
  try {
    input = await request.json();
  } catch {
    return { error: 'INVALID_JSON', message: 'Le body doit être un JSON valide' };
  }

  // Validation des champs obligatoires
  const validation = validateInput(input);
  if (!validation.valid) {
    return { error: 'VALIDATION_ERROR', message: validation.message };
  }

  // Construire le prompt utilisateur
  const userPrompt = buildUserPrompt(input);

  // Appel Claude API
  const analysisResult = await callClaudeAPI(userPrompt, env);

  return {
    input_recu: sanitizeInput(input),
    analyse: analysisResult,
    modele_ia: 'claude-sonnet-4-20250514',
    genere_le: new Date().toISOString(),
  };
}

// ─── Claude API ───────────────────────────────────────────────────────

async function callClaudeAPI(userPrompt, env) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':    'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        }
      ],
      messages: [
        {
          role:    'user',
          content: userPrompt,
        }
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Claude API error:', err);
    throw new Error('CLAUDE_API_ERROR');
  }

  const data = await response.json();
  const raw  = data.content?.[0]?.text ?? '{}';
  // Supprimer les balises markdown ```json ... ``` si présentes
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  try {
    return JSON.parse(text);
  } catch {
    return { raw, parse_error: true };
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────

function buildUserPrompt(input) {
  const dept      = input.departement ?? '971';
  const territory = { '971': 'Guadeloupe', '972': 'Martinique', '974': 'La Réunion', '976': 'Mayotte' }[dept] ?? 'Guadeloupe';

  return `Analyse de rentabilité solaire photovoltaïque — ${territory}

PARAMÈTRES DU PROJET :
- Puissance installée : ${input.puissance_kwc} kWc
- Commune : ${input.commune ?? 'Non précisée'} (${dept} — ${territory})
- Type de toiture : ${input.type_toit ?? 'Non précisé'}
- Inclinaison : ${input.inclinaison_degres ?? 15}°
- Orientation : ${input.orientation ?? 'sud'}
- Consommation annuelle : ${input.consommation_annuelle_kwh} kWh/an
- Tarif EDF OA : ${input.tarif_achat_edf_oa_eur_kwh ?? 0.18} €/kWh
- Coût installation : ${input.cout_installation_eur ? input.cout_installation_eur + '€ HT' : 'Non fourni — estimer'}
- Avec batterie : ${input.avec_batterie ? 'Oui' : 'Non'}
- Structure juridique : ${input.structure_juridique ?? 'particulier'}

Génère une analyse complète au format JSON strict avec cette structure :
{
  "resume_executif": {
    "puissance_kwc": number,
    "production_annuelle_kwh": number,
    "taux_autoconsommation_pct": number,
    "revenu_edf_oa_annuel_eur": number,
    "economies_annuelles_eur": number,
    "gain_total_annuel_eur": number,
    "cout_installation_estime_eur": number,
    "payback_ans": number,
    "tri_pct": number
  },
  "production": {
    "gisement_solaire_kwh_kwc_an": number,
    "production_annuelle_kwh": number,
    "production_mensuelle_moyenne_kwh": number,
    "pertes_systeme_pct": number,
    "hypotheses": string
  },
  "revenus_edf_oa": {
    "duree_contrat_ans": 20,
    "tarif_kwh_eur": number,
    "revenu_annuel_eur": number,
    "revenu_total_20_ans_eur": number,
    "indexation_annuelle_pct": number,
    "conditions_eligibilite": [string]
  },
  "autoconsommation": {
    "production_autoconsommee_kwh": number,
    "taux_pct": number,
    "economies_facture_eur_an": number,
    "tarif_evite_eur_kwh": number
  },
  "investissement": {
    "cout_installation_eur": number,
    "cout_par_kwc_eur": number,
    "est_estime": boolean,
    "fourchette_marche_dom": string
  },
  "rentabilite": {
    "payback_ans": number,
    "tri_sur_20_ans_pct": number,
    "van_5pct_eur": number,
    "gain_net_20_ans_eur": number
  },
  "fiscalite_244w": {
    "applicable": boolean,
    "conditions": string,
    "credit_impot_pct": 38.25,
    "assiette_eur": number,
    "credit_impot_eur": number,
    "retrocession_minimum_eur": number,
    "gain_net_investisseur_eur": number,
    "note": string
  },
  "raccordement": {
    "demarches": [string],
    "delai_estime_mois": number,
    "points_attention": [string]
  },
  "recommandations": [string],
  "disclaimer": string
}`;
}

// ─── Validation ───────────────────────────────────────────────────────

function validateInput(input) {
  if (!input.puissance_kwc || typeof input.puissance_kwc !== 'number' || input.puissance_kwc <= 0) {
    return { valid: false, message: 'puissance_kwc requis (nombre positif en kWc)' };
  }
  if (!input.consommation_annuelle_kwh || typeof input.consommation_annuelle_kwh !== 'number') {
    return { valid: false, message: 'consommation_annuelle_kwh requis (nombre en kWh)' };
  }
  if (input.puissance_kwc > 500) {
    return { valid: false, message: 'puissance_kwc max 500 kWc pour cet endpoint' };
  }
  return { valid: true };
}

function sanitizeInput(input) {
  const { ...safe } = input;
  return safe;
}
