/**
 * Spec OpenAPI 3.1 — Tropical Autonome Caribbean Data Marketplace
 * Exposée à GET /openapi.json
 */

export function buildOpenApiSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title:       'Tropical Autonome — Caribbean Data Marketplace',
      version:     '2.0.0',
      description: `Single entry point for AI agents accessing structured Caribbean data.

**Payment protocol (x402):**
1. Call any paid endpoint → receive HTTP 402 with \`price_usdc\` and \`address\`
2. Send exact USDC amount to that address on Base network (L2 Ethereum)
3. Retry with header: \`X-Payment: 0x{transaction_hash}\`

**Currency:** USDC on Base network
**Operator:** Tropical Autonome — Lamentin, Guadeloupe (971)
**Contact:** tropicalautonome@gmail.com`,
      contact: {
        name:  'Tropical Autonome',
        email: 'tropicalautonome@gmail.com',
        url:   'https://tropical-data-api.tropicalautonome.workers.dev',
      },
      license: {
        name: 'Commercial — x402 payment required',
      },
    },
    servers: [
      {
        url:         'https://tropical-data-api.tropicalautonome.workers.dev',
        description: 'Production (Cloudflare Workers)',
      },
    ],
    tags: [
      { name: 'discovery',     description: 'Endpoints publics gratuits' },
      { name: 'energy',        description: 'Énergie solaire ZNI — tarifs EDF OA, raccordement' },
      { name: 'fiscal',        description: 'Fiscalité et financement DOM' },
      { name: 'caye',          description: 'Produits caribéens premium — CAYE' },
      { name: 'biodiversity',  description: 'Biodiversité Caraïbes — eDNA, crédits' },
      { name: 'marketplace',   description: 'Endpoints fournisseurs tiers — commission 25%' },
      { name: 'analysis',      description: 'Analyses IA — Claude API' },
    ],
    paths: {

      // ── Discovery ─────────────────────────────────────────────────

      '/': {
        get: {
          tags:        ['discovery'],
          summary:     'Index API — liste tous les endpoints et leurs prix',
          operationId: 'getIndex',
          responses: {
            '200': { description: 'Index complet', content: { 'application/json': {} } },
          },
        },
      },
      '/llms.txt': {
        get: {
          tags:        ['discovery'],
          summary:     'Fichier de découverte pour agents IA (llms.txt)',
          operationId: 'getLlmsTxt',
          responses: {
            '200': { description: 'llms.txt dynamique', content: { 'text/plain': {} } },
          },
        },
      },
      '/health': {
        get: {
          tags:        ['discovery'],
          summary:     'Health check',
          operationId: 'getHealth',
          responses: {
            '200': { description: 'OK', content: { 'application/json': {} } },
          },
        },
      },
      '/marketplace/v1': {
        get: {
          tags:        ['marketplace'],
          summary:     'Catalogue marketplace — tous les fournisseurs actifs',
          operationId: 'listProviders',
          responses: {
            '200': { description: 'Liste des fournisseurs', content: { 'application/json': {} } },
          },
        },
      },

      // ── Énergie ───────────────────────────────────────────────────

      '/api/v1/edf-oa/tarifs-zni': {
        get: {
          tags:        ['energy'],
          summary:     'Tarifs EDF OA — Zones Non Interconnectées (ZNI)',
          description: 'Tarifs réglementés d\'achat de l\'électricité solaire en Guadeloupe (971), Martinique (972), La Réunion (974) et Mayotte (976). Contrats 20 ans.',
          operationId: 'getEdfOaTarifsZni',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.005'),
        },
      },
      '/api/v1/raccordement/guadeloupe': {
        get: {
          tags:        ['energy'],
          summary:     'Procédure raccordement réseau solaire Guadeloupe',
          description: 'Les 8 étapes du raccordement EDF SEI en Guadeloupe : de la demande de capacité à la mise en service. Délais réels terrain (12 projets 2020-2026).',
          operationId: 'getRaccordementGuadeloupe',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.010'),
        },
      },
      '/api/v1/analyse/rentabilite-solaire': {
        post: {
          tags:        ['analysis', 'energy'],
          summary:     'Analyse rentabilité solaire IA — Claude API',
          description: 'Analyse complète de rentabilité d\'un projet solaire en DOM : production annuelle, revenus EDF OA 20 ans, retour sur investissement, crédit d\'impôt 244W.',
          operationId: 'postAnalyseRentabilite',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['puissance_kwc', 'commune', 'departement'],
                  properties: {
                    puissance_kwc:            { type: 'number', example: 9 },
                    commune:                  { type: 'string', example: 'Lamentin' },
                    departement:              { type: 'string', example: '971' },
                    type_toit:                { type: 'string', example: 'tuiles' },
                    inclinaison_deg:          { type: 'number', example: 20 },
                    orientation:              { type: 'string', example: 'sud' },
                    consommation_annuelle_kwh: { type: 'number', example: 5000 },
                    cout_installation_eur:    { type: 'number', example: 18000 },
                  },
                },
              },
            },
          },
          responses: x402Responses('0.500'),
        },
      },

      // ── Fiscalité & Financement ───────────────────────────────────

      '/api/v1/fiscalite/244-quater-w': {
        get: {
          tags:        ['fiscal'],
          summary:     'Crédit d\'impôt Art. 244 quater W — investissements DOM',
          description: 'Données structurées sur le crédit d\'impôt DOM (38.25%) : conditions, plafonds, mécanisme de rétrocession (52.63% min), procédure 2069-RCI, cas pratiques projets solaires.',
          operationId: 'getFiscalite244W',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.020'),
        },
      },
      '/api/v1/financement/dom-energies': {
        get: {
          tags:        ['fiscal'],
          summary:     'Aides financement énergies renouvelables DOM',
          description: 'Chèque TIC Région Guadeloupe, BPI France DOM, ADEME subventions insulaires, FEDER 2021-2027. Conditions de cumul (règle de minimis 200k€/3 ans).',
          operationId: 'getFinancementDom',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.020'),
        },
      },

      // ── CAYE Premium ──────────────────────────────────────────────

      '/api/v1/caye/vanille': {
        get: {
          tags:        ['caye'],
          summary:     'Vanille caribéenne — marché mondial + Guadeloupe',
          description: 'Prix vanille Guadeloupe vs Madagascar vs Tahiti (USD/kg). Calendrier récolte, certifications bio, profil aromatique, canaux Dubai/Europe/US. Marché 2.1 Mds$ (+76% en 2024).',
          operationId: 'getCayeVanille',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.030'),
        },
      },
      '/api/v1/caye/vetiver': {
        get: {
          tags:        ['caye'],
          summary:     'Vétiver caribéen — parfumerie luxe',
          description: 'Prix huile essentielle vétiver caribéenne vs haïtienne vs indienne. Profil olfactif, potentiel Guadeloupe, marché global (Haïti 55% du marché mondial).',
          operationId: 'getCayeVetiver',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.030'),
        },
      },
      '/api/v1/caye/marche-premium': {
        get: {
          tags:        ['caye'],
          summary:     'Marché agro-transformation premium Caraïbes',
          description: 'Vue globale 4.2 Mds$ : cacao, miel, sel de mer, café, épices. Stratégie export Dubai/Moyen-Orient (imports alimentaires premium +18%/an). Opportunités par produit.',
          operationId: 'getCayeMarchePremium',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.050'),
        },
      },

      // ── Biodiversité ──────────────────────────────────────────────

      '/api/v1/biodiversite/guadeloupe': {
        get: {
          tags:        ['biodiversity'],
          summary:     'Biodiversité Guadeloupe — hotspot mondial',
          description: '10 600 espèces natives, 6% de la biodiversité nationale française. Espèces endémiques, écosystèmes (forêt sèche, mangrove, récifs), zones protégées.',
          operationId: 'getBiodiversiteGuadeloupe',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.010'),
        },
      },
      '/api/v1/biodiversite/edna-caraibes': {
        get: {
          tags:        ['biodiversity'],
          summary:     'Données eDNA marines Guadeloupe — étude MNHN 2021-2022',
          description: '300+ espèces poissons + 21 espèces cétacées documentées par ADN environnemental. Protocole eDNA applicable, dataset GBIF/OBIS public, méthodologie NatureMetrics.',
          operationId: 'getEdnaCaraibes',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.020'),
        },
      },
      '/api/v1/biodiversite/credits': {
        get: {
          tags:        ['biodiversity'],
          summary:     'Crédits biodiversité — TNFD, Plan Vivo, Verra',
          description: 'Mécanismes crédits biodiversité, standards certification (Plan Vivo, Verra), prix marché (USD/unité), applicabilité écosystèmes caribéens, connexion NatureMetrics.',
          operationId: 'getCredits',
          security:    [{ x402Payment: [] }],
          parameters:  [x402Header()],
          responses:   x402Responses('0.050'),
        },
      },

      // ── Marketplace fournisseurs tiers ────────────────────────────

      '/marketplace/v1/{provider}': {
        get: {
          tags:        ['marketplace'],
          summary:     'Carte fournisseur — endpoints et prix',
          operationId: 'getProvider',
          parameters: [
            { name: 'provider', in: 'path', required: true, schema: { type: 'string' }, example: 'agri-guadeloupe' },
          ],
          responses: {
            '200': { description: 'Carte fournisseur', content: { 'application/json': {} } },
            '404': { description: 'Fournisseur introuvable' },
          },
        },
      },
      '/marketplace/v1/{provider}/{endpoint}': {
        get: {
          tags:        ['marketplace'],
          summary:     'Endpoint fournisseur tiers — données payantes',
          description: 'Accès aux données d\'un fournisseur tiers. 25% de commission Tropical Autonome inclus dans le prix affiché.',
          operationId: 'getProviderEndpoint',
          security:    [{ x402Payment: [] }],
          parameters: [
            { name: 'provider',  in: 'path', required: true, schema: { type: 'string' } },
            { name: 'endpoint',  in: 'path', required: true, schema: { type: 'string' } },
            x402Header(),
          ],
          responses: x402Responses('variable — voir carte fournisseur'),
        },
      },
    },

    components: {
      securitySchemes: {
        x402Payment: {
          type:        'apiKey',
          in:          'header',
          name:        'X-Payment',
          description: 'Hash de transaction USDC sur Base network. Obtenir en répondant au 402 : envoyer le montant exact en USDC à l\'adresse indiquée, puis inclure le tx_hash ici.',
        },
      },
      schemas: {
        PaymentRequired: {
          type: 'object',
          properties: {
            error:        { type: 'string', example: 'Payment Required' },
            price_usdc:   { type: 'string', example: '0.020' },
            currency:     { type: 'string', example: 'USDC' },
            network:      { type: 'string', example: 'base' },
            address:      { type: 'string', example: '0x...' },
            endpoint:     { type: 'string' },
            instructions: { type: 'string' },
            x402_version: { type: 'string', example: '1.0' },
          },
        },
      },
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function x402Header() {
  return {
    name:        'X-Payment',
    in:          'header',
    required:    false,
    description: 'Hash de transaction USDC Base network (0x + 64 hex chars). Absent → reçoit HTTP 402.',
    schema:      { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
  };
}

function x402Responses(price) {
  return {
    '200': {
      description: 'Données retournées (paiement valide)',
      content: { 'application/json': {} },
    },
    '402': {
      description: `Payment Required — ${price} USDC sur Base network`,
      content: {
        'application/json': {
          schema: { '$ref': '#/components/schemas/PaymentRequired' },
        },
      },
    },
  };
}
