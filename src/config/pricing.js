/**
 * PRICING — Source unique de vérité pour les prix x402
 *
 * RÈGLE : ne jamais définir un prix ailleurs que dans ce fichier.
 * Pour les fournisseurs tiers, le prix est défini dans leur registre (KV).
 * Le helper `marketplacePrice` calcule le prix affiché à l'agent en
 * ajoutant la commission de la marketplace (25% par défaut).
 *
 * Prix en USDC (1 USDC = 1 USD)
 * Dernière mise à jour : 18 mai 2026
 * Repricing v2 : ×5 sur données premium uniques, micro-paiements sur données standards
 */

// ─── Endpoints Tropical Autonome (opérateur) ────────────────────────

export const PRICING = {

  // MODULE A — Énergie Solaire ZNI
  'edf-oa-tarifs-zni':          '0.020',   // tarifs réglementés — point d'entrée
  'raccordement-guadeloupe':    '0.020',
  'analyse-rentabilite':        '0.500',   // analyse IA — garder
  'cession-projet':             '0.050',

  // MODULE B — Fiscalité & Financement DOM
  'fiscalite-244w':             '0.100',   // données fiscales uniques ×5
  'financement-dom':            '0.050',
  'fiscalite-analyse':          '1.000',

  // MODULE C — Produits Caribéens Premium (CAYE)
  'caye-vanille':               '0.050',
  'caye-vetiver':               '0.050',
  'caye-marche-premium':        '0.050',
  'caye-analyse-export':        '0.500',

  // MODULE D — Biodiversité Caraïbes
  'biodiversite-guadeloupe':    '0.050',
  'edna-caraibes':              '0.100',   // données scientifiques MNHN uniques ×5
  'credits-biodiversite':       '0.100',   // marché ESG en explosion ×2

  // MODULE E — PME DOM
  'pme-guadeloupe-profils':     '0.050',

  // MODULE F — Foncier & Pêche Caraïbes
  'foncier-agricole-dom':       '0.050',
  'peche-artisanale-caraibes':  '0.050',

  // MODULE G — Solaire avancé & Tourisme
  'irradiation-solaire-dom':     '0.020',
  'tourisme-durable-guadeloupe': '0.050',

  // MODULE H — Commerce & Infrastructures
  'import-export-caraibes':      '0.050',
  'eau-assainissement-dom':      '0.050',

  // MODULE I — Données Temps Réel (gouvernementales)
  'marches-publics-guadeloupe':  '0.030',  // temps réel récurrent — accessible
  'marches-publics-dom':         '0.025',
};

// ─── Commission marketplace ──────────────────────────────────────────

export const COMMISSION_RATE = 0.25;      // 25% pour Tropical Autonome
export const PROVIDER_SHARE  = 0.75;      // 75% reversé au fournisseur

/**
 * Calcule le prix affiché à l'agent pour un endpoint fournisseur tiers.
 * Le fournisseur reçoit `providerPrice` ; la marketplace prend 25% en plus.
 *
 * Exemple : fournisseur fixe 0.020 USDC → agent paie 0.0267 USDC
 *
 * @param {string|number} providerPrice - prix net fournisseur (USDC)
 * @returns {{ total: string, providerShare: string, commissionShare: string }}
 */
export function marketplacePrice(providerPrice) {
  const net       = parseFloat(providerPrice);
  const total     = net / PROVIDER_SHARE;                        // prix brut agent
  const commission = total * COMMISSION_RATE;

  return {
    total:           total.toFixed(6),
    providerShare:   net.toFixed(6),
    commissionShare: commission.toFixed(6),
  };
}

/**
 * Décompose un paiement reçu en part fournisseur / part commission.
 * Utilisé par le ledger après validation du paiement.
 *
 * @param {string|number} paidAmount - montant total reçu (USDC)
 * @returns {{ providerShare: string, commissionShare: string }}
 */
export function splitPayment(paidAmount) {
  const total      = parseFloat(paidAmount);
  const provider   = total * PROVIDER_SHARE;
  const commission = total * COMMISSION_RATE;

  return {
    providerShare:   provider.toFixed(6),
    commissionShare: commission.toFixed(6),
  };
}
