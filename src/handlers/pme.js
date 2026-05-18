/**
 * Handler — PME Guadeloupe Profils
 * GET /api/v1/pme/guadeloupe
 */

export async function handlePme(request, env) {
  let data = await env.DATA_STORE.get('pme-guadeloupe', { type: 'json' });

  if (!data) {
    return {
      data:       null,
      meta:       { error: 'Données non disponibles — contacter tropicalautonome@gmail.com' },
      disclaimer: 'Données INSEE + CCI Guadeloupe à titre indicatif.',
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
