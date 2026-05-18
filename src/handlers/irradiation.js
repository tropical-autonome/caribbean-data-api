/**
 * Handler — Irradiation Solaire DOM
 * GET /api/v1/solaire/irradiation-dom
 */

export async function handleIrradiation(request, env) {
  let data = await env.DATA_STORE.get('irradiation-solaire-dom', { type: 'json' });

  if (!data) {
    return {
      data:       null,
      meta:       { error: 'Données non disponibles — contacter tropicalautonome@gmail.com' },
      disclaimer: 'Données NASA POWER + Solargis à titre de pré-dimensionnement uniquement.',
    };
  }

  return {
    data: data.data,
    meta: {
      last_verified:    data.last_verified,
      update_frequency: data.update_frequency,
      source_type:      data.source_type,
      sources:          data.sources,
      version:          data.version,
    },
    disclaimer: data.disclaimer,
  };
}
