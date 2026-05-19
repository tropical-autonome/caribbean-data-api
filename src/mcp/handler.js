/**
 * MCP Server — Tropical Autonome Caribbean Data Marketplace
 *
 * Transport : Streamable HTTP (stateless JSON-RPC)
 * Route     : POST /mcp
 *
 * Appelle les handlers directement en interne (pas de loopback HTTP).
 * Les outils payants vérifient le paiement via le middleware x402.
 * Les outils gratuits (discovery) répondent sans paiement.
 */

import { PRICING }                            from '../config/pricing.js';
import { handleX402 }                         from '../middleware/x402.js';
import { handleEdfOaTarifs }                  from '../handlers/edf-oa.js';
import { handleFiscalite }                    from '../handlers/fiscalite.js';
import { handleFinancement }                  from '../handlers/financement.js';
import { handleBiodiversite, handleEdna, handleCredits } from '../handlers/biodiversite.js';
import { handleAnalyse }                      from '../handlers/analyse.js';
import { handleRaccordement }                 from '../handlers/raccordement.js';
import { handleCayeVanille, handleCayeVetiver, handleCayeMarche } from '../handlers/caye.js';
import { handleFoncier }                                          from '../handlers/foncier.js';
import { handlePeche }                                            from '../handlers/peche.js';
import { handlePme }                                              from '../handlers/pme.js';
import { handleIrradiation }                                      from '../handlers/irradiation.js';
import { handleTourisme }                                         from '../handlers/tourisme.js';
import { handleImportExport }                                     from '../handlers/import-export.js';
import { handleEau }                                              from '../handlers/eau.js';
import { handleMarchesPublics }                                   from '../handlers/marches-publics.js';
import { handleMarchesPublicsDom }                                from '../handlers/marches-publics-dom.js';
import { listProviders, getProvider, getProviderEndpoint } from '../marketplace/registry.js';
import { handleMarketplaceX402 }              from '../middleware/x402.js';
import { creditLedger }                       from '../marketplace/commission.js';
import { marketplacePrice }                   from '../config/pricing.js';

const MCP_VERSION    = '2024-11-05';
const SERVER_NAME    = 'tropical-caribbean-data';
const SERVER_VERSION = '2.0.0';

// ─── Entry point ─────────────────────────────────────────────────────

export async function handleMcp(request, env) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (request.method === 'GET') {
    return jsonResp({
      server:      SERVER_NAME,
      version:     SERVER_VERSION,
      protocol:    MCP_VERSION,
      description: 'Tropical Autonome Caribbean Data Marketplace — MCP Server',
      transport:   'streamable-http',
      tools_count: ALL_TOOLS.length,
    });
  }

  if (request.method !== 'POST') {
    return mcpError(-32600, 'Method not allowed', null);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return mcpError(-32700, 'Parse error', null);
  }

  const { jsonrpc, method, params, id } = body;

  if (jsonrpc !== '2.0') {
    return mcpError(-32600, 'Invalid JSON-RPC version', id);
  }

  switch (method) {
    case 'initialize':
      return handleInitialize(id);
    case 'notifications/initialized':
      return mcpResult({}, id);
    case 'tools/list':
      return mcpResult({ tools: ALL_TOOLS }, id);
    case 'tools/call':
      return handleToolCall(params, id, env, request);
    case 'resources/list':
      return mcpResult({ resources: [] }, id);
    case 'prompts/list':
      return mcpResult({ prompts: [] }, id);
    default:
      return mcpError(-32601, `Method not found: ${method}`, id);
  }
}

// ─── initialize ──────────────────────────────────────────────────────

function handleInitialize(id) {
  return mcpResult({
    protocolVersion: MCP_VERSION,
    capabilities:    { tools: { listChanged: false } },
    serverInfo:      { name: SERVER_NAME, version: SERVER_VERSION },
    instructions:    `Tu accèdes à la marketplace de données caribéennes structurées de Tropical Autonome.

ENDPOINTS GRATUITS (3) : caribbean_list_marketplace, caribbean_get_provider, caribbean_get_llms_txt

ENDPOINTS PAYANTS (USDC sur Base network) :
1. Appelle l'outil sans payment_tx_hash → reçois price_usdc + wallet_address
2. Envoie exactement ce montant en USDC à cette adresse sur Base network
3. Rappelle l'outil avec payment_tx_hash = hash de la transaction (0x + 64 hex)`,
  }, id);
}

// ─── tools/call dispatcher ───────────────────────────────────────────

async function handleToolCall(params, id, env, request) {
  const { name, arguments: args = {} } = params ?? {};

  const tool = ALL_TOOLS.find(t => t.name === name);
  if (!tool) {
    return mcpError(-32602, `Outil introuvable: ${name}`, id);
  }

  try {
    const result = await executeTool(name, args, env, request);
    return mcpResult({
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }, id);
  } catch (err) {
    console.error(`[MCP] Erreur outil ${name}:`, err.message);
    return mcpError(-32603, err.message, id);
  }
}

// ─── executeTool ─────────────────────────────────────────────────────

async function executeTool(name, args, env, request) {

  // ── Outils gratuits ──────────────────────────────────────────────

  if (name === 'caribbean_list_marketplace') {
    const providers = await listProviders(env, { status: 'active' });
    return {
      success: true,
      total_providers: providers.length,
      providers: providers.map(p => ({
        slug:           p.slug,
        name:           p.name,
        description:    p.description,
        verified:       p.verified,
        endpoint_count: Object.keys(p.endpoints ?? {}).length,
        endpoints: Object.entries(p.endpoints ?? {}).map(([slug, def]) => {
          const { total } = marketplacePrice(def.price_usdc);
          return {
            path:        `/marketplace/v1/${p.slug}/${slug}`,
            method:      def.method ?? 'GET',
            description: def.description,
            price_usdc:  total,
            tags:        def.tags ?? [],
          };
        }),
      })),
    };
  }

  if (name === 'caribbean_get_provider') {
    const slug = args.provider_slug;
    if (!slug) return { error: 'provider_slug requis' };
    const provider = await getProvider(env, slug);
    if (!provider) return { error: `Fournisseur introuvable: ${slug}` };

    return {
      success: true,
      provider: {
        slug:     provider.slug,
        name:     provider.name,
        description: provider.description,
        verified: provider.verified,
        contact:  provider.contact_email,
        endpoints: Object.entries(provider.endpoints ?? {}).map(([epSlug, def]) => {
          const { total } = marketplacePrice(def.price_usdc);
          return {
            slug:        epSlug,
            path:        `/marketplace/v1/${slug}/${epSlug}`,
            method:      def.method ?? 'GET',
            description: def.description,
            price_usdc:  total,
            tags:        def.tags ?? [],
          };
        }),
        total_transactions: provider.total_transactions,
      },
    };
  }

  if (name === 'caribbean_get_llms_txt') {
    // Retourne le contenu llms.txt directement depuis KV
    const index = await env.PROVIDERS_STORE.get('providers:index', { type: 'json' }) ?? [];
    return {
      success: true,
      discovery_url: 'https://tropical-data-api.tropicalautonome.workers.dev/llms.txt',
      openapi_url:   'https://tropical-data-api.tropicalautonome.workers.dev/openapi.json',
      mcp_url:       'https://tropical-data-api.tropicalautonome.workers.dev/mcp',
      operator_endpoints: Object.entries(OPERATOR_MAP).map(([toolName, cfg]) => ({
        tool:      toolName,
        path:      cfg.path,
        price_usdc: PRICING[cfg.priceKey],
      })),
      active_providers: index.length,
    };
  }

  // ── Outils payants — opérateur ───────────────────────────────────

  if (OPERATOR_MAP[name]) {
    const cfg    = OPERATOR_MAP[name];
    const txHash = args.payment_tx_hash ?? null;

    // Construire une fausse Request pour le middleware x402
    const fakeReq = buildFakeRequest(cfg.path, cfg.method, txHash, name === 'caribbean_analyse_solaire' ? args : null);
    const payCheck = await handleX402(fakeReq, env, cfg.priceKey, cfg.path);

    if (payCheck !== null) {
      // 402 → retourner instructions de paiement
      const payData = await payCheck.json();
      return {
        error_type:    'payment_required',
        status:        402,
        price_usdc:    payData.price_usdc,
        currency:      'USDC',
        network:       'base',
        wallet_address: payData.address,
        instructions:  'Envoyez exactement ce montant en USDC sur Base network, puis rappelez cet outil avec payment_tx_hash = hash de la transaction.',
      };
    }

    // Paiement valide → appeler le handler
    const data = await cfg.handler(fakeReq, env);
    return { success: true, endpoint: cfg.path, ...data };
  }

  // ── Outil générique marketplace fournisseurs ─────────────────────

  if (name === 'caribbean_get_marketplace_data') {
    const { provider_slug, endpoint_slug, payment_tx_hash } = args;
    if (!provider_slug || !endpoint_slug) {
      return { error: 'provider_slug et endpoint_slug requis' };
    }

    const { provider, endpoint } = await getProviderEndpoint(env, provider_slug, endpoint_slug);
    if (!provider) return { error: `Fournisseur introuvable: ${provider_slug}` };
    if (!endpoint) return { error: `Endpoint introuvable: ${endpoint_slug}` };

    const endpointPath = `/marketplace/v1/${provider_slug}/${endpoint_slug}`;
    const txHash       = payment_tx_hash ?? null;
    const fakeReq      = buildFakeRequest(endpointPath, 'GET', txHash, null);

    const payCheck = await handleMarketplaceX402(fakeReq, env, provider, endpoint, endpointPath);
    if (payCheck !== null) {
      const payData = await payCheck.json();
      return {
        error_type:          'payment_required',
        status:              402,
        price_usdc:          payData.price_usdc,
        currency:            'USDC',
        network:             'base',
        wallet_address:      payData.address,
        provider_name:       payData.provider_name,
        provider_share_usdc: payData.provider_share_usdc,
        commission_usdc:     payData.commission_usdc,
        instructions:        'Envoyez exactement ce montant en USDC sur Base network, puis rappelez cet outil avec payment_tx_hash = hash de la transaction.',
      };
    }

    // Paiement valide → lire les données depuis DATA_STORE
    const data = await env.DATA_STORE.get(endpoint.data_kv_key, { type: 'json' });
    return {
      success:  true,
      provider: provider_slug,
      endpoint: endpoint_slug,
      data:     data ?? { error: 'Données temporairement indisponibles' },
    };
  }

  return { error: `Outil non implémenté: ${name}` };
}

// ─── Helpers ─────────────────────────────────────────────────────────

const OPERATOR_MAP = {
  'caribbean_get_edf_oa_tarifs':        { path: '/api/v1/edf-oa/tarifs-zni',           method: 'GET',  priceKey: 'edf-oa-tarifs-zni',         handler: handleEdfOaTarifs },
  'caribbean_get_raccordement':         { path: '/api/v1/raccordement/guadeloupe',      method: 'GET',  priceKey: 'raccordement-guadeloupe',    handler: handleRaccordement },
  'caribbean_get_fiscalite_244w':       { path: '/api/v1/fiscalite/244-quater-w',       method: 'GET',  priceKey: 'fiscalite-244w',             handler: handleFiscalite },
  'caribbean_get_financement_dom':      { path: '/api/v1/financement/dom-energies',     method: 'GET',  priceKey: 'financement-dom',            handler: handleFinancement },
  'caribbean_get_caye_vanille':         { path: '/api/v1/caye/vanille',                 method: 'GET',  priceKey: 'caye-vanille',               handler: handleCayeVanille },
  'caribbean_get_caye_vetiver':         { path: '/api/v1/caye/vetiver',                 method: 'GET',  priceKey: 'caye-vetiver',               handler: handleCayeVetiver },
  'caribbean_get_caye_marche':          { path: '/api/v1/caye/marche-premium',          method: 'GET',  priceKey: 'caye-marche-premium',        handler: handleCayeMarche },
  'caribbean_get_biodiversite':         { path: '/api/v1/biodiversite/guadeloupe',      method: 'GET',  priceKey: 'biodiversite-guadeloupe',    handler: handleBiodiversite },
  'caribbean_get_edna':                 { path: '/api/v1/biodiversite/edna-caraibes',   method: 'GET',  priceKey: 'edna-caraibes',              handler: handleEdna },
  'caribbean_get_credits_biodiversite': { path: '/api/v1/biodiversite/credits',         method: 'GET',  priceKey: 'credits-biodiversite',       handler: handleCredits },
  'caribbean_analyse_solaire':          { path: '/api/v1/analyse/rentabilite-solaire',  method: 'POST', priceKey: 'analyse-rentabilite',        handler: handleAnalyse },
  'caribbean_get_foncier_agricole':     { path: '/api/v1/foncier/agricole-dom',         method: 'GET',  priceKey: 'foncier-agricole-dom',        handler: handleFoncier },
  'caribbean_get_peche_artisanale':     { path: '/api/v1/peche/artisanale-caraibes',    method: 'GET',  priceKey: 'peche-artisanale-caraibes',   handler: handlePeche },
  'caribbean_get_pme_guadeloupe':       { path: '/api/v1/pme/guadeloupe',               method: 'GET',  priceKey: 'pme-guadeloupe-profils',      handler: handlePme },
  'caribbean_get_irradiation_dom':      { path: '/api/v1/solaire/irradiation-dom',      method: 'GET',  priceKey: 'irradiation-solaire-dom',     handler: handleIrradiation },
  'caribbean_get_tourisme_guadeloupe':  { path: '/api/v1/tourisme/guadeloupe',          method: 'GET',  priceKey: 'tourisme-durable-guadeloupe', handler: handleTourisme },
  'caribbean_get_import_export':        { path: '/api/v1/commerce/import-export',       method: 'GET',  priceKey: 'import-export-caraibes',      handler: handleImportExport },
  'caribbean_get_eau_dom':              { path: '/api/v1/infrastructure/eau-dom',       method: 'GET',  priceKey: 'eau-assainissement-dom',      handler: handleEau },
  'caribbean_get_marches_publics':      { path: '/api/v1/marches-publics/guadeloupe',   method: 'GET',  priceKey: 'marches-publics-guadeloupe',   handler: handleMarchesPublics },
  'caribbean_get_marches_publics_dom':  { path: '/api/v1/marches-publics/dom',          method: 'GET',  priceKey: 'marches-publics-dom',          handler: handleMarchesPublicsDom },
};

function buildFakeRequest(path, method, txHash, body) {
  const url     = `https://tropical-data-api.tropicalautonome.workers.dev${path}`;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (txHash) headers.set('X-Payment', txHash);

  const init = { method, headers };
  if (body && method === 'POST') {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResp(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function mcpResult(result, id) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', result, id }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function mcpError(code, message, id) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    error:   { code, message },
    id,
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ─── Définitions des outils (schémas) ────────────────────────────────

const ALL_TOOLS = [
  {
    name:        'caribbean_list_marketplace',
    description: 'Liste tous les fournisseurs actifs de la marketplace caribéenne avec leurs endpoints et prix. Gratuit.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name:        'caribbean_get_provider',
    description: 'Retourne la carte complète d\'un fournisseur : description, endpoints, prix, statut vérification. Gratuit.',
    inputSchema: {
      type: 'object',
      properties: {
        provider_slug: { type: 'string', description: 'Identifiant fournisseur (ex: agri-guadeloupe)' },
      },
      required: ['provider_slug'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name:        'caribbean_get_llms_txt',
    description: 'Vue d\'ensemble de la marketplace : liste des outils disponibles, URLs de découverte (llms.txt, openapi.json, mcp). Gratuit — point de départ recommandé.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name:        'caribbean_get_edf_oa_tarifs',
    description: `Tarifs EDF OA pour l'énergie solaire en ZNI (971, 972, 974, 976). Contrats 20 ans. Prix : ${PRICING['edf-oa-tarifs-zni']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_raccordement',
    description: `Procédure raccordement réseau solaire Guadeloupe : 8 étapes EDF SEI, délais réels terrain. Prix : ${PRICING['raccordement-guadeloupe']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_fiscalite_244w',
    description: `Crédit d'impôt 244 quater W DOM : taux 38.25%, rétrocession 52.63%, formulaire 2069-RCI, cas pratiques. Prix : ${PRICING['fiscalite-244w']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_financement_dom',
    description: `Aides financement ENR en DOM : Chèque TIC Région, BPI France, ADEME, FEDER 2021-2027, cumul minimis. Prix : ${PRICING['financement-dom']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_caye_vanille',
    description: `Marché vanille caribéenne : prix Guadeloupe vs Madagascar vs Tahiti, récolte, certifications, canaux Dubai/Europe. Marché 2.1 Mds$. Prix : ${PRICING['caye-vanille']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_caye_vetiver',
    description: `Vétiver caribéen parfumerie luxe : prix vs Haïti vs Inde, profil olfactif, potentiel Guadeloupe. Prix : ${PRICING['caye-vetiver']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_caye_marche',
    description: `Marché agro-transformation premium Caraïbes 4.2 Mds$ : cacao, miel, sel, café, épices. Stratégie Dubai. Prix : ${PRICING['caye-marche-premium']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_biodiversite',
    description: `Biodiversité Guadeloupe hotspot mondial : 10 600 espèces, écosystèmes, zones protégées. Prix : ${PRICING['biodiversite-guadeloupe']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_edna',
    description: `Données eDNA marines Guadeloupe MNHN 2021-2022 : 300+ espèces poissons, 21 cétacées, protocole eDNA. Prix : ${PRICING['edna-caraibes']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_credits_biodiversite',
    description: `Crédits biodiversité Caraïbes : TNFD, Plan Vivo, Verra, NatureMetrics, prix marché USD/unité. Prix : ${PRICING['credits-biodiversite']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_analyse_solaire',
    description: `Analyse rentabilité solaire IA (Claude) : production kWh, revenus EDF OA 20 ans, TRI, crédit 244W. Prix : ${PRICING['analyse-rentabilite']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        puissance_kwc:             { type: 'number', description: 'Puissance en kWc (ex: 9)' },
        commune:                   { type: 'string', description: 'Commune (ex: Lamentin)' },
        departement:               { type: 'string', description: 'Code département (971, 972, 974, 976)' },
        type_toit:                 { type: 'string', description: 'Type toiture (tuiles, tôle, terrasse)' },
        inclinaison_deg:           { type: 'number', description: 'Inclinaison en degrés' },
        orientation:               { type: 'string', description: 'Orientation (sud, est-ouest)' },
        consommation_annuelle_kwh: { type: 'number', description: 'Consommation annuelle kWh' },
        cout_installation_eur:     { type: 'number', description: 'Coût installation en euros' },
        payment_tx_hash:           { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: ['puissance_kwc', 'commune', 'departement'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_import_export',
    description: `Import/export Caraïbes : flux douaniers Guadeloupe (285M€ exports — rhum AOC, banane, produits mer), opportunités Dubai (vanille, rhum, HE), logistique, certifications export. Prix : ${PRICING['import-export-caraibes']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_eau_dom',
    description: `Eau et assainissement DOM : crise eau Guadeloupe (60% pertes réseau), SMGEAG, 1,2 Mds€ travaux 2022-2030, appels d'offres en cours, dessalement, chlordécone. Prix : ${PRICING['eau-assainissement-dom']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_pme_guadeloupe',
    description: `Intelligence économique Guadeloupe : 42 000 entreprises, 6 secteurs clés (BTP, ENR, agriculture, services), profils TPE/PME, points de douleur, réseaux CCI/BPI. Prix : ${PRICING['pme-guadeloupe-profils']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_irradiation_dom',
    description: `Irradiation solaire DOM par commune : GHI + PVOUT (Guadeloupe, Martinique, La Réunion, Mayotte). Données NASA POWER + Solargis. Formule production kWh/an incluse. Prix : ${PRICING['irradiation-solaire-dom']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_tourisme_guadeloupe',
    description: `Tourisme durable Guadeloupe : 870 000 visiteurs 2024, hébergements labellisés (Clef Verte, Ecolabel), flux par marché, zones d'attractivité, opportunités éco-lodges et digital nomades. Prix : ${PRICING['tourisme-durable-guadeloupe']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_foncier_agricole',
    description: `Foncier agricole DOM (Guadeloupe, Martinique, La Réunion) : prix par zone (8 000-18 000€/ha), agrivoltaïsme (loyer 1 500-3 000€/ha/an), SAFER, FEADER, cas pratiques. Prix : ${PRICING['foncier-agricole-dom']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_peche_artisanale',
    description: `Pêche artisanale Caraïbes : 190 000 t/an, 85% artisanale. Prix espèces Guadeloupe (langouste 18€ quai → 55€ restaurant, dorade 4.50€ → 18€), réglementation, export. Prix : ${PRICING['peche-artisanale-caraibes']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_marches_publics_dom',
    description: `Marchés publics tous DOM en temps réel — 31 000+ contrats (Guadeloupe 971, Martinique 972, Guyane 973, La Réunion 974, Mayotte 976). DECP officielle. Filtres : département, nature, année. Prix : ${PRICING['marches-publics-dom']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
        limit:       { type: 'number', description: 'Nombre de résultats (max 100, défaut 20)' },
        offset:      { type: 'number', description: 'Pagination' },
        nature:      { type: 'string', description: 'Travaux | Fournitures | Services' },
        annee:       { type: 'string', description: 'Ex: 2024' },
        departement: { type: 'string', description: '971 | 972 | 973 | 974 | 976' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_marches_publics',
    description: `Marchés publics Guadeloupe (971) en temps réel — 4 400+ contrats depuis la base DECP officielle. Filtres : nature (Travaux/Fournitures/Services), année, pagination. Données fraîches à chaque appel. Prix : ${PRICING['marches-publics-guadeloupe']} USDC.`,
    inputSchema: {
      type: 'object',
      properties: {
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base (0x+64hex). Absent = instructions paiement.' },
        limit:  { type: 'number', description: 'Nombre de résultats (max 100, défaut 20)' },
        offset: { type: 'number', description: 'Pagination (défaut 0)' },
        nature: { type: 'string', description: 'Filtrer par nature : Travaux | Fournitures | Services' },
        annee:  { type: 'string', description: 'Filtrer par année ex: 2024' },
      },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name:        'caribbean_get_marketplace_data',
    description: 'Accède aux données d\'un fournisseur tiers de la marketplace. Utiliser caribbean_list_marketplace d\'abord pour connaître les slugs disponibles. Commission 25% incluse dans le prix.',
    inputSchema: {
      type: 'object',
      properties: {
        provider_slug:   { type: 'string', description: 'Slug fournisseur (ex: agri-guadeloupe)' },
        endpoint_slug:   { type: 'string', description: 'Slug endpoint (ex: filieres-banane)' },
        payment_tx_hash: { type: 'string', description: 'Hash tx USDC Base.' },
      },
      required: ['provider_slug', 'endpoint_slug'],
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];
