/**
 * Handlers — Biodiversité Caraïbes (3 endpoints)
 * GET /api/v1/biodiversite/guadeloupe
 * GET /api/v1/biodiversite/edna-caraibes
 * GET /api/v1/biodiversite/credits
 */

export async function handleBiodiversite(request, env) {
  let data = await env.DATA_STORE.get('biodiversite-guadeloupe', { type: 'json' });
  if (!data) data = fallbackBiodiversite();

  return {
    data: data.data,
    meta: {
      last_verified:    data.last_verified,
      sources:          data.sources,
      update_frequency: data.update_frequency,
      version:          data.version,
    },
    disclaimer: data.disclaimer,
  };
}

export async function handleEdna(request, env) {
  let data = await env.DATA_STORE.get('edna-especes', { type: 'json' });
  if (!data) data = fallbackEdna();

  return {
    data: data.data,
    meta: {
      last_verified:  data.last_verified,
      sources:        data.sources,
      source_type:    data.source_type,
      version:        data.version,
    },
    disclaimer: data.disclaimer,
  };
}

export async function handleCredits(request, env) {
  let data = await env.DATA_STORE.get('credits-biodiversite', { type: 'json' });
  if (!data) data = fallbackCredits();

  return {
    data: data.data,
    meta: {
      last_verified:    data.last_verified,
      sources:          data.sources,
      update_frequency: data.update_frequency,
      version:          data.version,
    },
    disclaimer: data.disclaimer,
  };
}

// ─── Fallbacks statiques ──────────────────────────────────────────────

function fallbackBiodiversite() {
  return {
    version: '1.0', last_verified: '2026-05-14', update_frequency: 'annual',
    sources: [{ name: 'ARB Guadeloupe' }, { name: 'DEAL' }, { name: 'Parc National' }],
    disclaimer: "Données indicatives — fallback statique actif.",
    data: {
      statut_hotspot: { est_hotspot_mondial: true, part_biodiversite_nationale: '6%' },
      chiffres_cles: { especes_totales_natives: 10600, especes_endemiques_strictes: 1240 },
      note: 'Données complètes disponibles via KV.',
    }
  };
}

function fallbackEdna() {
  return {
    version: '1.0', last_verified: '2026-05-14', source_type: 'scientific_study',
    sources: [{ name: 'MNHN UMR BOREA — étude eDNA 2021-2022' }],
    disclaimer: "Fallback statique — données complètes via KV.",
    data: {
      etude: { organisme: 'MNHN', periode: '2021-2022', zone: 'Côte ouest Basse-Terre' },
      resultats: { especes_poissons_detectees: 300, especes_cetaces_detectees: 21 },
    }
  };
}

function fallbackCredits() {
  return {
    version: '1.0', last_verified: '2026-05-14', update_frequency: 'quarterly',
    sources: [{ name: 'TNFD v1.0' }, { name: 'Plan Vivo' }, { name: 'Verra' }],
    disclaimer: "Fallback statique — données complètes via KV.",
    data: {
      contexte_marche: { taille_marche_projetee_2030_USD_milliards: 2 },
      prix_USD_unite: { moyen: 25, premium_ecosystemes_tropicaux: 50 },
    }
  };
}
