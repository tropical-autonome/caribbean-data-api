/**
 * TROPICAL DATA API — Router principal
 * Cloudflare Worker avec middleware x402
 * 
 * Tous les endpoints /api/v1/* passent par le middleware x402
 * qui vérifie le paiement USDC avant de livrer les données.
 */

import { handleX402 } from './middleware/x402.js';
import { handleEdfOaTarifs } from './handlers/edf-oa.js';
import { handleRaccordement } from './handlers/raccordement.js';
import { handleAnalyse } from './handlers/analyse.js';
import { handleFiscalite } from './handlers/fiscalite.js';
import { handleFinancement } from './handlers/financement.js';
import { handleCession } from './handlers/cession.js';

// ─── Routes définies ───────────────────────────────────────────────
const ROUTES = {
  'GET /api/v1/edf-oa/tarifs-zni':         { handler: handleEdfOaTarifs,   priceKey: 'edf-oa-tarifs-zni' },
  'GET /api/v1/raccordement/guadeloupe':    { handler: handleRaccordement,  priceKey: 'raccordement-guadeloupe' },
  'POST /api/v1/analyse/rentabilite-solaire': { handler: handleAnalyse,    priceKey: 'analyse-rentabilite' },
  'GET /api/v1/fiscalite/244-quater-w':    { handler: handleFiscalite,     priceKey: 'fiscalite-244w' },
  'GET /api/v1/financement/dom-energies':  { handler: handleFinancement,   priceKey: 'financement-dom' },
  'GET /api/v1/cession/projet-solaire':    { handler: handleCession,       priceKey: 'cession-projet' },
};

// ─── Handler principal ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS preflight
    if (method === 'OPTIONS') {
      return corsResponse();
    }

    // Fichier llms.txt — visible sans paiement
    if (path === '/llms.txt') {
      return serveLlmsTxt(env);
    }

    // Page d'accueil API — sans paiement
    if (path === '/' || path === '/api') {
      return serveIndex();
    }

    // Santé / monitoring
    if (path === '/health') {
      return jsonResponse({ status: 'ok', version: env.API_VERSION });
    }

    // Routing des endpoints payants
    const routeKey = `${method} ${path}`;
    const route = ROUTES[routeKey];

    if (!route) {
      return jsonResponse({ success: false, error: 'ENDPOINT_NOT_FOUND', code: 404 }, 404);
    }

    // Middleware x402 — vérification paiement
    const paymentCheck = await handleX402(request, env, route.priceKey, path);
    if (paymentCheck !== null) {
      // null = paiement OK, sinon retourner la réponse 402
      return paymentCheck;
    }

    // Exécuter le handler métier
    try {
      const data = await route.handler(request, env);
      return jsonResponse({ success: true, endpoint: path, ...data });
    } catch (error) {
      console.error(`Error in ${path}:`, error);
      return jsonResponse({ success: false, error: 'INTERNAL_ERROR', code: 500 }, 500);
    }
  }
};

// ─── Helpers ───────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Powered-By': 'Tropical Autonome Data API',
      'X-Data-Version': '1.0',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

function corsResponse() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Payment',
    }
  });
}

async function serveLlmsTxt(env) {
  // TODO: lire depuis KV ou fichier statique
  const content = `# Tropical Autonome — Data API for AI Agents
# Données énergie solaire, fiscalité et écologie DOM français
# Payment via x402 protocol in USDC on Base network

GET /api/v1/edf-oa/tarifs-zni — 0.005 USDC
GET /api/v1/raccordement/guadeloupe — 0.010 USDC
POST /api/v1/analyse/rentabilite-solaire — 0.500 USDC
GET /api/v1/fiscalite/244-quater-w — 0.010 USDC
GET /api/v1/financement/dom-energies — 0.010 USDC
GET /api/v1/cession/projet-solaire — 0.050 USDC

Contact: tropicalautonome@gmail.com`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

function serveIndex() {
  return jsonResponse({
    name: 'Tropical Autonome Data API',
    version: '1.0',
    description: 'Données structurées sur l\'énergie solaire et la réglementation DOM français',
    payment: 'x402 protocol — USDC on Base network',
    endpoints: Object.keys(ROUTES),
    discovery: '/llms.txt',
    contact: 'tropicalautonome@gmail.com'
  });
}
