/**
 * Handler — Pêche Artisanale Caraïbes
 * GET /api/v1/peche/artisanale-caraibes
 */

export async function handlePeche(request, env) {
  let data = await env.DATA_STORE.get('peche-artisanale-caraibes', { type: 'json' });

  if (!data) {
    return {
      data:    null,
      meta:    { error: 'Données non disponibles — contacter tropicalautonome@gmail.com' },
      disclaimer: 'Prix au débarquement indicatifs. Vérifier auprès du CRPMEM Guadeloupe.',
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
