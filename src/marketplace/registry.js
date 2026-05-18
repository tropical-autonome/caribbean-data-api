/**
 * Provider Registry — CRUD fournisseurs de la marketplace
 *
 * Stockage Cloudflare KV (binding : PROVIDERS_STORE)
 *
 * Schéma KV :
 *   provider:{slug}         → objet fournisseur complet
 *   providers:index         → tableau des slugs actifs
 *
 * Schéma fournisseur :
 * {
 *   slug:            string,          // identifiant URL-safe unique
 *   name:            string,          // nom affiché
 *   description:     string,
 *   wallet_address:  string,          // adresse USDC Base pour reversements
 *   contact_email:   string,
 *   status:          "active"|"suspended"|"pending",
 *   commission_rate: 0.25,            // toujours 0.25 (override possible admin)
 *   endpoints: {
 *     [endpointSlug]: {
 *       method:      "GET"|"POST",
 *       description: string,
 *       price_usdc:  string,          // prix NET fournisseur (avant commission)
 *       data_kv_key: string,          // clé KV où lire les données JSON
 *       tags:        string[]         // ex: ["energie", "guadeloupe"]
 *     }
 *   },
 *   created_at:  string,   // ISO date
 *   verified:    boolean,  // vérifié manuellement par l'opérateur
 *   total_transactions: number
 * }
 */

const INDEX_KEY = 'providers:index';

// ─── Lecture ─────────────────────────────────────────────────────────

export async function getProvider(env, slug) {
  const raw = await env.PROVIDERS_STORE.get(`provider:${slug}`, { type: 'json' });
  return raw;
}

export async function listProviders(env, { status = 'active' } = {}) {
  const index = await env.PROVIDERS_STORE.get(INDEX_KEY, { type: 'json' }) ?? [];

  const providers = await Promise.all(
    index.map(slug => env.PROVIDERS_STORE.get(`provider:${slug}`, { type: 'json' }))
  );

  return providers
    .filter(p => p !== null && (status === 'all' || p.status === status));
}

export async function getProviderEndpoint(env, providerSlug, endpointSlug) {
  const provider = await getProvider(env, providerSlug);
  if (!provider) return { provider: null, endpoint: null };

  const endpoint = provider.endpoints?.[endpointSlug] ?? null;
  return { provider, endpoint };
}

// ─── Écriture ─────────────────────────────────────────────────────────

export async function createProvider(env, data) {
  validateProviderData(data);

  const slug = data.slug;
  const existing = await getProvider(env, slug);
  if (existing) {
    throw new Error(`PROVIDER_EXISTS: slug "${slug}" déjà utilisé`);
  }

  const provider = {
    slug,
    name:            data.name,
    description:     data.description ?? '',
    wallet_address:  data.wallet_address,
    contact_email:   data.contact_email ?? '',
    status:          'pending',
    commission_rate: 0.25,
    endpoints:       data.endpoints ?? {},
    created_at:      new Date().toISOString(),
    verified:        false,
    total_transactions: 0,
  };

  await env.PROVIDERS_STORE.put(`provider:${slug}`, JSON.stringify(provider));
  await addToIndex(env, slug);

  return provider;
}

export async function updateProvider(env, slug, updates) {
  const provider = await getProvider(env, slug);
  if (!provider) throw new Error(`PROVIDER_NOT_FOUND: ${slug}`);

  // Champs protégés — non modifiables via update standard
  const { slug: _s, created_at: _c, total_transactions: _t, ...safeUpdates } = updates;

  const updated = { ...provider, ...safeUpdates };
  await env.PROVIDERS_STORE.put(`provider:${slug}`, JSON.stringify(updated));
  return updated;
}

export async function addEndpoint(env, providerSlug, endpointSlug, endpointDef) {
  const provider = await getProvider(env, providerSlug);
  if (!provider) throw new Error(`PROVIDER_NOT_FOUND: ${providerSlug}`);

  validateEndpointDef(endpointDef);

  provider.endpoints[endpointSlug] = {
    method:      endpointDef.method ?? 'GET',
    description: endpointDef.description,
    price_usdc:  endpointDef.price_usdc,
    data_kv_key: endpointDef.data_kv_key,
    tags:        endpointDef.tags ?? [],
    created_at:  new Date().toISOString(),
  };

  await env.PROVIDERS_STORE.put(`provider:${providerSlug}`, JSON.stringify(provider));
  return provider;
}

export async function deleteProvider(env, slug) {
  await env.PROVIDERS_STORE.delete(`provider:${slug}`);
  await removeFromIndex(env, slug);
}

export async function incrementTransactionCount(env, slug) {
  const provider = await getProvider(env, slug);
  if (!provider) return;
  provider.total_transactions = (provider.total_transactions ?? 0) + 1;
  await env.PROVIDERS_STORE.put(`provider:${slug}`, JSON.stringify(provider));
}

// ─── Index ────────────────────────────────────────────────────────────

async function addToIndex(env, slug) {
  const index = await env.PROVIDERS_STORE.get(INDEX_KEY, { type: 'json' }) ?? [];
  if (!index.includes(slug)) {
    index.push(slug);
    await env.PROVIDERS_STORE.put(INDEX_KEY, JSON.stringify(index));
  }
}

async function removeFromIndex(env, slug) {
  const index = await env.PROVIDERS_STORE.get(INDEX_KEY, { type: 'json' }) ?? [];
  const updated = index.filter(s => s !== slug);
  await env.PROVIDERS_STORE.put(INDEX_KEY, JSON.stringify(updated));
}

// ─── Validation ───────────────────────────────────────────────────────

function validateProviderData(data) {
  const required = ['slug', 'name', 'wallet_address'];
  for (const field of required) {
    if (!data[field]) throw new Error(`VALIDATION: champ requis manquant: ${field}`);
  }

  if (!/^[a-z0-9-]+$/.test(data.slug)) {
    throw new Error('VALIDATION: slug doit être en minuscules, chiffres et tirets uniquement');
  }

  if (!data.wallet_address.startsWith('0x') || data.wallet_address.length !== 42) {
    throw new Error('VALIDATION: wallet_address doit être une adresse Ethereum valide (0x + 40 hex)');
  }
}

function validateEndpointDef(def) {
  if (!def.description) throw new Error('VALIDATION: description endpoint requise');
  if (!def.price_usdc)  throw new Error('VALIDATION: price_usdc requis');
  if (!def.data_kv_key) throw new Error('VALIDATION: data_kv_key requis');

  const price = parseFloat(def.price_usdc);
  if (isNaN(price) || price <= 0) {
    throw new Error('VALIDATION: price_usdc doit être un nombre positif');
  }
}
