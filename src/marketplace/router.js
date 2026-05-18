/**
 * Marketplace Router — Routing des requêtes vers les fournisseurs tiers
 *
 * Routes gérées :
 *   GET  /marketplace/v1/                        → catalogue de tous les fournisseurs
 *   GET  /marketplace/v1/{provider}              → fiche fournisseur + ses endpoints
 *   ANY  /marketplace/v1/{provider}/{endpoint}   → endpoint payant (via x402)
 *   POST /marketplace/v1/{provider}/settle       → demande de reversement (auth fournisseur)
 *   GET  /marketplace/v1/{provider}/ledger       → solde fournisseur (auth fournisseur)
 */

import { getProvider, getProviderEndpoint, listProviders, incrementTransactionCount } from './registry.js';
import { handleMarketplaceX402 } from '../middleware/x402.js';
import { getLedger, getOperations, requestSettlement } from './commission.js';
import { marketplacePrice } from '../config/pricing.js';

// ─── Dispatcher principal ─────────────────────────────────────────────

export async function handleMarketplace(request, env, pathname) {
  // Normaliser : /marketplace/v1 → segments après le préfixe
  const segments = pathname.replace(/^\/marketplace\/v1\/?/, '').split('/').filter(Boolean);

  // GET /marketplace/v1/ — catalogue
  if (segments.length === 0) {
    return handleCatalogue(env);
  }

  const [providerSlug, endpointSlug] = segments;

  // GET /marketplace/v1/{provider} — fiche fournisseur
  if (!endpointSlug) {
    return handleProviderCard(env, providerSlug);
  }

  // POST /marketplace/v1/{provider}/settle — demande reversement
  if (endpointSlug === 'settle' && request.method === 'POST') {
    return handleSettle(request, env, providerSlug);
  }

  // GET /marketplace/v1/{provider}/ledger — solde
  if (endpointSlug === 'ledger' && request.method === 'GET') {
    return handleLedger(request, env, providerSlug);
  }

  // ANY /marketplace/v1/{provider}/{endpoint} — endpoint fournisseur payant
  return handleProviderEndpoint(request, env, providerSlug, endpointSlug, pathname);
}

// ─── Catalogue ────────────────────────────────────────────────────────

async function handleCatalogue(env) {
  const providers = await listProviders(env, { status: 'active' });

  const catalogue = providers.map(p => ({
    slug:        p.slug,
    name:        p.name,
    description: p.description,
    verified:    p.verified,
    endpoint_count: Object.keys(p.endpoints ?? {}).length,
    endpoints: Object.entries(p.endpoints ?? {}).map(([slug, def]) => {
      const pricing = marketplacePrice(def.price_usdc);
      return {
        path:        `/marketplace/v1/${p.slug}/${slug}`,
        method:      def.method ?? 'GET',
        description: def.description,
        price_usdc:  pricing.total,         // prix affiché à l'agent (brut + commission)
        tags:        def.tags ?? [],
      };
    }),
  }));

  return jsonResponse({
    success: true,
    marketplace: 'Tropical Autonome Caribbean Data Marketplace',
    version: 'v1',
    commission_rate: '25%',
    payment: 'x402 — USDC on Base network',
    total_providers: catalogue.length,
    providers: catalogue,
    discovery: '/llms.txt',
  });
}

// ─── Fiche fournisseur ────────────────────────────────────────────────

async function handleProviderCard(env, providerSlug) {
  const provider = await getProvider(env, providerSlug);
  if (!provider || provider.status !== 'active') {
    return jsonResponse({ success: false, error: 'PROVIDER_NOT_FOUND' }, 404);
  }

  const endpoints = Object.entries(provider.endpoints ?? {}).map(([slug, def]) => {
    const pricing = marketplacePrice(def.price_usdc);
    return {
      slug,
      path:          `/marketplace/v1/${providerSlug}/${slug}`,
      method:        def.method ?? 'GET',
      description:   def.description,
      price_usdc:    pricing.total,
      tags:          def.tags ?? [],
    };
  });

  return jsonResponse({
    success:  true,
    provider: {
      slug:        provider.slug,
      name:        provider.name,
      description: provider.description,
      verified:    provider.verified,
      contact:     provider.contact_email,
      endpoints,
      total_transactions: provider.total_transactions,
    }
  });
}

// ─── Endpoint fournisseur payant ──────────────────────────────────────

async function handleProviderEndpoint(request, env, providerSlug, endpointSlug, pathname) {
  const { provider, endpoint } = await getProviderEndpoint(env, providerSlug, endpointSlug);

  if (!provider) {
    return jsonResponse({ success: false, error: 'PROVIDER_NOT_FOUND' }, 404);
  }
  if (provider.status !== 'active') {
    return jsonResponse({ success: false, error: 'PROVIDER_SUSPENDED' }, 503);
  }
  if (!endpoint) {
    return jsonResponse({ success: false, error: 'ENDPOINT_NOT_FOUND' }, 404);
  }
  if (endpoint.method && endpoint.method !== request.method) {
    return jsonResponse({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  // Passer le ctx dans env pour le waitUntil du ledger
  const paymentCheck = await handleMarketplaceX402(request, env, provider, endpoint, pathname);
  if (paymentCheck !== null) return paymentCheck;

  // Lire les données depuis KV
  const data = await env.DATA_STORE.get(endpoint.data_kv_key, { type: 'json' });
  if (!data) {
    return jsonResponse({ success: false, error: 'DATA_UNAVAILABLE', message: 'Données temporairement indisponibles' }, 503);
  }

  // Incrémenter le compteur de transactions (non bloquant)
  if (env.ctx?.waitUntil) {
    env.ctx.waitUntil(incrementTransactionCount(env, providerSlug));
  }

  const pricing = marketplacePrice(endpoint.price_usdc);

  return jsonResponse({
    success:   true,
    provider:  provider.slug,
    provider_name: provider.name,
    endpoint:  pathname,
    pricing: {
      paid_usdc:        pricing.total,
      provider_net:     pricing.providerShare,
      marketplace_fee:  pricing.commissionShare,
    },
    data,
    disclaimer: data.disclaimer ?? `Données fournies par ${provider.name}. Tropical Autonome agit en tant qu'intermédiaire technique uniquement.`,
  });
}

// ─── Ledger fournisseur ───────────────────────────────────────────────

async function handleLedger(request, env, providerSlug) {
  if (!isProviderAuthenticated(request, env, providerSlug)) {
    return jsonResponse({ success: false, error: 'UNAUTHORIZED' }, 401);
  }

  const provider  = await getProvider(env, providerSlug);
  if (!provider) return jsonResponse({ success: false, error: 'PROVIDER_NOT_FOUND' }, 404);

  const ledger = await getLedger(env, providerSlug);
  const ops    = await getOperations(env, providerSlug);

  return jsonResponse({
    success:  true,
    provider: providerSlug,
    ledger,
    recent_operations: ops.slice(0, 20),
  });
}

// ─── Settlement ───────────────────────────────────────────────────────

async function handleSettle(request, env, providerSlug) {
  if (!isProviderAuthenticated(request, env, providerSlug)) {
    return jsonResponse({ success: false, error: 'UNAUTHORIZED' }, 401);
  }

  const provider = await getProvider(env, providerSlug);
  if (!provider) return jsonResponse({ success: false, error: 'PROVIDER_NOT_FOUND' }, 404);

  try {
    const result = await requestSettlement(env, providerSlug, provider.wallet_address);
    return jsonResponse({
      success: true,
      message: 'Demande de reversement enregistrée. Virement USDC sous 48h ouvrées.',
      ...result,
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 400);
  }
}

// ─── Auth fournisseur ─────────────────────────────────────────────────

function isProviderAuthenticated(request, env, providerSlug) {
  const authHeader = request.headers.get('X-Provider-Key');
  if (!authHeader) return false;

  // Chaque fournisseur a une clé stockée dans un secret wrangler :
  //   wrangler secret put PROVIDER_KEY_agri-guadeloupe
  // Normalisé : tirets → underscores pour les noms de secrets
  const secretName = `PROVIDER_KEY_${providerSlug.replace(/-/g, '_')}`;
  const expected   = env[secretName];

  if (!expected) return false;
  return authHeader === expected;
}

// ─── Helper ───────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type':         'application/json',
      'X-Powered-By':         'Tropical Autonome Marketplace',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
