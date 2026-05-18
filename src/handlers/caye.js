/**
 * Handlers — Produits Caribéens Premium CAYE
 * GET /api/v1/caye/vanille
 * GET /api/v1/caye/vetiver
 * GET /api/v1/caye/marche-premium
 */

export async function handleCayeVanille(request, env) {
  let data = await env.DATA_STORE.get('caye-vanille', { type: 'json' });
  if (!data) data = fallback('caye-vanille', 'Vanille caribéenne — marché mondial + Guadeloupe');

  return {
    data:       data.data,
    meta:       buildMeta(data),
    disclaimer: data.disclaimer,
  };
}

export async function handleCayeVetiver(request, env) {
  let data = await env.DATA_STORE.get('caye-vetiver', { type: 'json' });
  if (!data) data = fallback('caye-vetiver', 'Vétiver caribéen — parfumerie luxe');

  return {
    data:       data.data,
    meta:       buildMeta(data),
    disclaimer: data.disclaimer,
  };
}

export async function handleCayeMarche(request, env) {
  let data = await env.DATA_STORE.get('caye-marche-caraibes', { type: 'json' });
  if (!data) data = fallback('caye-marche', 'Vue marché agro-transformation premium Caraïbes');

  return {
    data:       data.data,
    meta:       buildMeta(data),
    disclaimer: data.disclaimer,
  };
}

function buildMeta(data) {
  return {
    last_verified:    data.last_verified,
    sources:          data.sources,
    source_type:      data.source_type,
    update_frequency: data.update_frequency,
    version:          data.version,
  };
}

function fallback(key, description) {
  return {
    version: '1.0', last_verified: '2026-05-14',
    update_frequency: 'quarterly', source_type: 'market_data',
    sources: [{ name: 'Tropical Autonome' }],
    disclaimer: 'Fallback statique — données complètes via KV.',
    data: { description, note: `Données complètes disponibles — clé KV: ${key}` },
  };
}
