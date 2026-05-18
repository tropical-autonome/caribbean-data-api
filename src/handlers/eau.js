/**
 * Handler — Eau et Assainissement DOM
 * GET /api/v1/infrastructure/eau-dom
 */

export async function handleEau(request, env) {
  let data = await env.DATA_STORE.get('eau-assainissement-dom', { type: 'json' });

  if (!data) {
    return {
      data:       null,
      meta:       { error: 'Données non disponibles — contacter tropicalautonome@gmail.com' },
      disclaimer: 'Données DEAL + SMGEAG + ARPEGE à titre indicatif. Situation en évolution rapide.',
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
