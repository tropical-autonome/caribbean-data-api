/**
 * Handler — Raccordement réseau EDF SEI Guadeloupe
 * GET /api/v1/raccordement/guadeloupe
 */

export async function handleRaccordement(request, env) {
  let data = await env.DATA_STORE.get('raccordement-guadeloupe', { type: 'json' });

  if (!data) data = getStaticData();

  return {
    data: data.data,
    meta: {
      last_verified:    data.last_verified,
      sources:          data.sources,
      source_type:      data.source_type,
      periode_observee: data.periode_observee,
      update_frequency: data.update_frequency,
      version:          data.version,
    },
    disclaimer: data.disclaimer,
  };
}

function getStaticData() {
  return {
    version:          '1.0',
    last_verified:    '2026-05-14',
    update_frequency: 'semi-annual',
    source_type:      'field_experience',
    periode_observee: '2020-2026',
    sources: [{ name: 'Tropical Autonome — terrain Guadeloupe 2020-2026' }],
    disclaimer: "Données terrain — fallback statique actif.",
    data: {
      operateur:     'EDF SEI Guadeloupe',
      etapes_count:  8,
      duree_realiste_mois: 10,
      note: 'Données complètes disponibles via KV.',
    }
  };
}
