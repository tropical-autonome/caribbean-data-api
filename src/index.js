/**
 * TROPICAL AUTONOME — Caribbean Data Marketplace
 * Cloudflare Worker — Router principal
 *
 * Deux espaces de routes :
 *   /api/v1/*          → endpoints propres Tropical Autonome (paiement direct)
 *   /marketplace/v1/*  → endpoints fournisseurs tiers (commission 25%)
 *   /admin/*           → CRUD fournisseurs (protégé X-Admin-Key)
 *   /llms.txt          → découverte pour agents IA
 */

import { handleX402 }                          from './middleware/x402.js';
import { handleEdfOaTarifs }                   from './handlers/edf-oa.js';
import { handleFiscalite }                     from './handlers/fiscalite.js';
import { handleFinancement }                   from './handlers/financement.js';
import { handleBiodiversite, handleEdna, handleCredits } from './handlers/biodiversite.js';
import { handleAnalyse }                                from './handlers/analyse.js';
import { handleRaccordement }                          from './handlers/raccordement.js';
import { handleCayeVanille, handleCayeVetiver, handleCayeMarche } from './handlers/caye.js';
import { handleFoncier }                                          from './handlers/foncier.js';
import { handlePeche }                                            from './handlers/peche.js';
import { handlePme }                                              from './handlers/pme.js';
import { handleIrradiation }                                      from './handlers/irradiation.js';
import { handleTourisme }                                         from './handlers/tourisme.js';
import { handleImportExport }                                     from './handlers/import-export.js';
import { handleEau }                                              from './handlers/eau.js';
import { handleMarketplace }                   from './marketplace/router.js';
import { handleAdmin }                         from './handlers/admin-providers.js';
import { PRICING }                             from './config/pricing.js';
import { buildOpenApiSpec }                    from './openapi.js';
import { handleMcp }                           from './mcp/handler.js';

// ─── Routes Tropical Autonome ──────────────────────────────────────────

const OPERATOR_ROUTES = {
  // MODULE A — Énergie Solaire
  'GET /api/v1/edf-oa/tarifs-zni':              { handler: handleEdfOaTarifs,  priceKey: 'edf-oa-tarifs-zni' },
  'GET /api/v1/raccordement/guadeloupe':        { handler: handleRaccordement, priceKey: 'raccordement-guadeloupe' },
  'POST /api/v1/analyse/rentabilite-solaire':   { handler: handleAnalyse,      priceKey: 'analyse-rentabilite' },
  // MODULE B — Fiscalité & Financement
  'GET /api/v1/fiscalite/244-quater-w':    { handler: handleFiscalite,   priceKey: 'fiscalite-244w' },
  'GET /api/v1/financement/dom-energies':  { handler: handleFinancement, priceKey: 'financement-dom' },
  // MODULE D — Biodiversité
  'GET /api/v1/biodiversite/guadeloupe':   { handler: handleBiodiversite, priceKey: 'biodiversite-guadeloupe' },
  'GET /api/v1/biodiversite/edna-caraibes':{ handler: handleEdna,         priceKey: 'edna-caraibes' },
  'GET /api/v1/biodiversite/credits':      { handler: handleCredits,      priceKey: 'credits-biodiversite' },
  // MODULE C — CAYE Produits Premium
  'GET /api/v1/caye/vanille':              { handler: handleCayeVanille,  priceKey: 'caye-vanille' },
  'GET /api/v1/caye/vetiver':              { handler: handleCayeVetiver,  priceKey: 'caye-vetiver' },
  'GET /api/v1/caye/marche-premium':       { handler: handleCayeMarche,   priceKey: 'caye-marche-premium' },
  // MODULE F — Foncier & Pêche Caraïbes
  'GET /api/v1/foncier/agricole-dom':      { handler: handleFoncier,      priceKey: 'foncier-agricole-dom' },
  'GET /api/v1/peche/artisanale-caraibes': { handler: handlePeche,        priceKey: 'peche-artisanale-caraibes' },
  // MODULE G — PME, Solaire avancé, Tourisme
  'GET /api/v1/pme/guadeloupe':            { handler: handlePme,          priceKey: 'pme-guadeloupe-profils' },
  'GET /api/v1/solaire/irradiation-dom':   { handler: handleIrradiation,  priceKey: 'irradiation-solaire-dom' },
  'GET /api/v1/tourisme/guadeloupe':       { handler: handleTourisme,     priceKey: 'tourisme-durable-guadeloupe' },
  // MODULE H — Commerce & Infrastructures
  'GET /api/v1/commerce/import-export':    { handler: handleImportExport, priceKey: 'import-export-caraibes' },
  'GET /api/v1/infrastructure/eau-dom':    { handler: handleEau,          priceKey: 'eau-assainissement-dom' },
};

// ─── Worker principal ──────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    // Passer le ctx dans env pour le waitUntil non bloquant (ledger)
    env.ctx = ctx;

    const url    = new URL(request.url);
    const method = request.method;
    const path   = url.pathname;

    if (method === 'OPTIONS') return corsResponse();

    // ── Routes publiques (sans paiement) ──────────────────────────────

    if (path === '/llms.txt')           return serveLlmsTxt(env);
    if (path === '/openapi.json')       return serveOpenApi();
    if (path === '/mcp' || path === '/mcp/') return handleMcp(request, env);
    if (path === '/' || path === '/api') return serveIndex();
    if (path === '/health')             return jsonResponse({ status: 'ok', version: env.API_VERSION });

    // ── Marketplace fournisseurs ──────────────────────────────────────
    if (path.startsWith('/marketplace/v1')) {
      return handleMarketplace(request, env, path);
    }

    // ── Admin (protégé) ───────────────────────────────────────────────
    if (path.startsWith('/admin/providers') || path === '/admin/ledger') {
      return handleAdmin(request, env, path);
    }

    // ── Endpoints Tropical Autonome (payants) ─────────────────────────
    const routeKey = `${method} ${path}`;
    const route    = OPERATOR_ROUTES[routeKey];

    if (!route) {
      return jsonResponse({ success: false, error: 'ENDPOINT_NOT_FOUND' }, 404);
    }

    const paymentCheck = await handleX402(request, env, route.priceKey, path);
    if (paymentCheck !== null) return paymentCheck;

    try {
      const data = await route.handler(request, env);
      return jsonResponse({ success: true, endpoint: path, ...data });
    } catch (error) {
      console.error(`Error in ${path}:`, error);
      return jsonResponse({ success: false, error: 'INTERNAL_ERROR' }, 500);
    }
  }
};

// ─── Helpers ───────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type':                  'application/json',
      'X-Powered-By':                  'Tropical Autonome Marketplace',
      'X-Data-Version':                '2.0',
      'Access-Control-Allow-Origin':   '*',
    }
  });
}

function corsResponse() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Payment, X-Admin-Key, X-Provider-Key',
    }
  });
}

function serveIndex() {
  const operatorEndpoints = Object.entries(OPERATOR_ROUTES).map(([k, v]) => ({
    route:     k,
    price_usdc: PRICING[v.priceKey],
  }));

  return jsonResponse({
    name:        'Tropical Autonome Caribbean Data Marketplace',
    version:     '2.0',
    description: 'Point d\'entrée unique pour les données caribéennes structurées. Accès via protocole x402 — paiement automatique USDC.',
    payment:     'x402 protocol — USDC on Base network',
    spaces: {
      operator:    '/api/v1/*          — Données Tropical Autonome (énergie, fiscalité, biodiversité)',
      marketplace: '/marketplace/v1/*  — Données fournisseurs tiers (25% commission)',
      admin:       '/admin/*           — Gestion fournisseurs (accès restreint)',
    },
    operator_endpoints: operatorEndpoints,
    marketplace:        '/marketplace/v1',
    discovery:          '/llms.txt',
    contact:            'tropicalautonome@gmail.com',
  });
}

function serveOpenApi() {
  return new Response(JSON.stringify(buildOpenApiSpec(), null, 2), {
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function serveLlmsTxt(env) {
  const content = await buildDynamicLlmsTxt(env);
  return new Response(content, {
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',   // cache 5 min côté CDN
    }
  });
}

async function buildDynamicLlmsTxt(env) {
  const now = new Date().toISOString().split('T')[0];

  // ── Endpoints opérateur ──────────────────────────────────────────
  const operatorLines = Object.entries(OPERATOR_ROUTES).map(([routeKey, v]) => {
    const [method, path] = routeKey.split(' ');
    const price = PRICING[v.priceKey];
    return `${method} ${path} — ${price} USDC`;
  }).join('\n');

  // ── Fournisseurs marketplace (depuis KV) ─────────────────────────
  let marketplaceLines = '';
  try {
    const index = await env.PROVIDERS_STORE.get('providers:index', { type: 'json' }) ?? [];
    if (index.length > 0) {
      const providerBlocks = await Promise.all(
        index.map(async slug => {
          const p = await env.PROVIDERS_STORE.get(`provider:${slug}`, { type: 'json' });
          if (!p || p.status !== 'active') return null;

          const endpointLines = Object.entries(p.endpoints ?? {}).map(([epSlug, def]) => {
            const net   = parseFloat(def.price_usdc);
            const total = (net / 0.75).toFixed(4);
            return `  ${def.method ?? 'GET'} /marketplace/v1/${slug}/${epSlug} — ${total} USDC\n    ${def.description}`;
          }).join('\n');

          return `### ${p.name}${p.verified ? ' ✓' : ''}\n${p.description}\n${endpointLines}`;
        })
      );
      const activeBlocks = providerBlocks.filter(Boolean);
      if (activeBlocks.length > 0) {
        marketplaceLines = activeBlocks.join('\n\n');
      }
    }
  } catch {
    marketplaceLines = '(aucun fournisseur actif)';
  }

  return `# Tropical Autonome — Caribbean Data Marketplace
# Single entry point for AI agents accessing Caribbean structured data
# Operator: Frederick Martel — Lamentin, Guadeloupe (971)
# Contact: tropicalautonome@gmail.com
# Updated: ${now}

## MCP SERVER (recommended for AI agents)

Native MCP integration — no URL required, tools auto-discovered by Claude and MCP clients.
Endpoint: POST https://tropical-data-api.tropicalautonome.workers.dev/mcp
Protocol: MCP 2024-11-05 — Streamable HTTP — 15 tools available
Free tools: caribbean_list_marketplace, caribbean_get_provider, caribbean_get_llms_txt
Paid tools: all data endpoints (USDC on Base — x402 protocol)

## PAYMENT PROTOCOL

All paid endpoints use HTTP 402 (x402 protocol).
Currency: USDC on Base network (L2 Ethereum).
Workflow:
  1. Call endpoint → receive 402 with price_usdc and wallet address
  2. Send exact USDC amount to that address on Base network
  3. Retry with header: X-Payment: 0x{transaction_hash}

## OPERATOR ENDPOINTS — Tropical Autonome (direct pricing, no commission)

${operatorLines}

## MARKETPLACE — Free discovery

GET /marketplace/v1 — FREE
  Full catalogue of all active third-party providers and their endpoints.

GET /marketplace/v1/{provider-slug} — FREE
  Provider card: name, description, verified status, all endpoints with prices.

## MARKETPLACE — Third-party provider endpoints${marketplaceLines ? '\n\n' + marketplaceLines : '\n\n(aucun fournisseur actif — contacter tropicalautonome@gmail.com pour intégrer vos données)'}

## PROVIDER SELF-SERVICE (X-Provider-Key header required)

POST /marketplace/v1/{provider}/settle — request USDC payout of earned balance
GET  /marketplace/v1/{provider}/ledger — view balance and transaction history

## TAGS

energie, solaire, zni, dom, fiscalite, financement, biodiversite, edna, credits-biodiversite,
caye, vanille, vetiver, agriculture, peche, tourisme, foncier, meteo, caraibes, guadeloupe

## VERSION

API v2.0 — x402 marketplace — ${now}
`;
}
