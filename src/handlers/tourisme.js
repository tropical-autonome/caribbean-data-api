/**
 * Handler — Tourisme Durable Guadeloupe
 * GET /api/v1/tourisme/guadeloupe
 */

export async function handleTourisme(request, env) {
  let data = await env.DATA_STORE.get('tourisme-durable-guadeloupe', { type: 'json' });

  if (!data) {
    return {
      data:       null,
      meta:       { error: 'Données non disponibles — contacter tropicalautonome@gmail.com' },
      disclaimer: 'Données CTIG + INSEE + Atout France à titre indicatif.',
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
