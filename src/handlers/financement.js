/**
 * Handler — Financement DOM énergies et projets
 * GET /api/v1/financement/dom-energies
 */

export async function handleFinancement(request, env) {
  let data = await env.DATA_STORE.get('financement-dom', { type: 'json' });

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
    source_type:      'official + field_experience',
    periode_observee: '2023-2026',
    sources: [
      { name: 'Région Guadeloupe' },
      { name: 'BPI France Antilles-Guyane' },
      { name: 'ADEME Guadeloupe' },
      { name: 'FEDER 2021-2027 Guadeloupe' },
    ],
    disclaimer: "Montants indicatifs. Vérifier l'ouverture des guichets avant dépôt.",
    data: {
      note: 'Données complètes disponibles via KV — données statiques de secours actives.',
      dispositifs: ['Chèque TIC Région', 'BPI France DOM', 'ADEME', 'FEDER 2021-2027'],
    }
  };
}
