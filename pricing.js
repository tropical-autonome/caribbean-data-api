/**
 * PRICING — Source unique de vérité pour les prix x402
 * Modifier ici pour changer les prix de tous les endpoints
 * Prix en USDC (1 USDC = 1 USD)
 * Dernière mise à jour : 13 mai 2026
 */

export const PRICING = {

  // ─── MODULE A — Énergie Solaire ZNI ────────────────────────────
  'edf-oa-tarifs-zni':          '0.005',  // Tarifs EDF OA + historique
  'raccordement-guadeloupe':    '0.010',  // Process raccordement terrain
  'analyse-rentabilite':        '0.500',  // Analyse complète (Claude API)
  'cession-projet':             '0.050',  // Structure juridique cession

  // ─── MODULE B — Fiscalité & Financement DOM ─────────────────────
  'fiscalite-244w':             '0.020',  // Article 244 quater W CGI complet
  'financement-dom':            '0.020',  // Subventions + financement DOM
  'fiscalite-analyse':          '1.000',  // Analyse fiscale personnalisée (Claude API)

  // ─── MODULE C — Produits Caribéens Premium (CAYE) ───────────────
  'caye-vanille':               '0.030',  // Prix + marché vanille caribéenne
  'caye-vetiver':               '0.030',  // Prix + marché vétiver caribéen
  'caye-marche-premium':        '0.050',  // Vue marché complet agro-transformation
  'caye-analyse-export':        '0.500',  // Analyse export personnalisée (Claude API)

  // ─── MODULE D — Biodiversité Caraïbes ──────────────────────────
  'biodiversite-guadeloupe':    '0.010',  // Inventaire espèces + écosystèmes
  'edna-caraibes':              '0.020',  // Données eDNA marines Guadeloupe
  'credits-biodiversite':       '0.050',  // Mécanismes + prix crédits biodiversité

  // ─── MODULE E — Automatisation IA PME DOM ──────────────────────
  'pme-guadeloupe-profils':     '0.020',  // Profils PME automatisables
};
