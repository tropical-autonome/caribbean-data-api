/**
 * Handler — Foncier Agricole DOM
 * GET /api/v1/foncier/agricole-dom
 */

export async function handleFoncier(request, env) {
  let data = await env.DATA_STORE.get('foncier-agricole-dom', { type: 'json' });

  if (!data) {
    return {
      data:    null,
      meta:    { error: 'Données non disponibles — contacter tropicalautonome@gmail.com' },
      disclaimer: 'Prix indicatifs. Consulter SAFER Antilles-Guyane avant toute transaction foncière.',
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
