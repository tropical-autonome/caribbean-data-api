/**
 * Handler — Tarifs EDF OA Zone Non Interconnectée
 * GET /api/v1/edf-oa/tarifs-zni
 */

export async function handleEdfOaTarifs(request, env) {
  let data = await env.DATA_STORE.get('tarifs-edf-oa', { type: 'json' });

  if (!data) data = getStaticData();

  return {
    data: data.data,
    meta: {
      last_verified:    data.last_verified,
      source:           data.sources?.[0]?.name ?? 'CRE / EDF SEI',
      zone:             'DOM français (971, 972, 974, 976)',
      update_frequency: data.update_frequency,
      version:          data.version,
    },
    disclaimer: "Données à titre informatif. Vérifier les tarifs en vigueur auprès d'EDF SEI avant tout investissement.",
  };
}

function getStaticData() {
  return {
    version:          '1.0',
    last_verified:    '2026-05-14',
    update_frequency: 'quarterly',
    sources: [{ name: 'CRE - Commission de Régulation de l\'Énergie' }],
    data: {
      description: 'Tarifs EDF Obligation d\'Achat ZNI',
      zones: {
        '971': { name: 'Guadeloupe',  tarif_actuel_kwh_eur: 0.18,   duree_contrat_ans: 20 },
        '972': { name: 'Martinique',  tarif_actuel_kwh_eur: 0.18,   duree_contrat_ans: 20 },
        '974': { name: 'La Réunion',  tarif_actuel_kwh_eur: 0.1654, duree_contrat_ans: 20 },
        '976': { name: 'Mayotte',     tarif_actuel_kwh_eur: 0.175,  duree_contrat_ans: 20 },
      },
      conditions_eligibilite: [
        'Installation raccordée au réseau EDF SEI',
        'Puissance entre 3 et 100 kWc',
        'Dossier de raccordement validé',
        'Professionnel certifié RGE',
      ],
    }
  };
}
