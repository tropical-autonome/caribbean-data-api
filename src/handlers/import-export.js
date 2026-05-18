/**
 * Handler — Import/Export Caraïbes
 * GET /api/v1/commerce/import-export-caraibes
 */

export async function handleImportExport(request, env) {
  let data = await env.DATA_STORE.get('import-export-caraibes', { type: 'json' });

  if (!data) {
    return {
      data:       null,
      meta:       { error: 'Données non disponibles — contacter tropicalautonome@gmail.com' },
      disclaimer: 'Statistiques douanières à titre indicatif.',
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
