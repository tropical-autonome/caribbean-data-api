#!/usr/bin/env node
/**
 * Seed — Ajoute un fournisseur test "agri-guadeloupe" dans KV
 * Usage : node scripts/seed-test-provider.js
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const PROVIDERS_NS = 'be9668dec23146b48d00b743ce2ea2f4';
const DATA_NS      = '1586a3cdecd14e0f983e80367536505e';

// ─── Fournisseur test : Agri Guadeloupe ──────────────────────────────

const provider = {
  slug:            'agri-guadeloupe',
  name:            'Agri Guadeloupe',
  description:     'Données agricoles structurées — filières banane, canne, maraîchage et élevage en Guadeloupe. Issu du réseau de terrain de la Chambre d\'Agriculture.',
  wallet_address:  '0x0000000000000000000000000000000000000001',
  contact_email:   'contact@agri-guadeloupe.test',
  status:          'active',
  commission_rate: 0.25,
  verified:        true,
  created_at:      new Date().toISOString(),
  total_transactions: 0,
  endpoints: {
    'filieres-banane': {
      method:      'GET',
      description: 'Filière banane Guadeloupe — volumes, prix départ exploitation, marchés export, aides PAC 2023-2027.',
      price_usdc:  '0.030',
      data_kv_key: 'agri-filieres-banane',
      tags:        ['agriculture', 'banane', 'guadeloupe', 'export', 'pac'],
      created_at:  new Date().toISOString(),
    },
    'marche-local': {
      method:      'GET',
      description: 'Prix du marché local Guadeloupe — légumes, fruits, produits transformés. Relevés hebdomadaires marchés de Pointe-à-Pitre, Basse-Terre, Le Moule.',
      price_usdc:  '0.015',
      data_kv_key: 'agri-marche-local',
      tags:        ['agriculture', 'marche', 'prix', 'guadeloupe', 'local'],
      created_at:  new Date().toISOString(),
    },
  },
};

const filieresBanane = {
  version:          '1.0',
  last_verified:    '2026-05-14',
  update_frequency: 'quarterly',
  source_type:      'market_data + field_experience',
  sources: [
    { name: 'Chambre d\'Agriculture de Guadeloupe — Bilan filière 2025' },
    { name: 'UGPBAN (Union des Groupements de Producteurs de Banane)' },
    { name: 'FranceAgriMer — données importation banane antillaise 2024' },
  ],
  disclaimer: 'Données indicatives — prix et volumes sujets à variations saisonnières. Contacter UGPBAN pour données contractuelles.',
  data: {
    production_annuelle: {
      guadeloupe_tonnes: 57000,
      martinique_tonnes: 140000,
      part_banane_antillaise_marche_france_pct: 13,
    },
    prix_depart_exploitation: {
      banane_classe_1_eur_kg:  0.28,
      banane_bio_eur_kg:       0.42,
      banane_equitable_eur_kg: 0.35,
    },
    aides_pac_2023_2027: {
      aide_couplee_banane_eur_tonne: 15.50,
      plafond_ha: 40,
      criteres: 'Producteurs déclarés en Guadeloupe, surface minimale 1 ha, engagement 5 ans',
    },
    marches_export: {
      france_metropole: { part_pct: 68, operateurs: ['LIDL', 'Système U', 'Carrefour'] },
      europe_autre:     { part_pct: 20, pays: ['Allemagne', 'Royaume-Uni', 'Belgique'] },
      caraibes_local:   { part_pct: 12 },
    },
    potentiel_agro_transformation: {
      farine_banane_verte:   { prix_kg_eur: 4.5  },
      chips_banane_plantain: { prix_kg_eur: 12   },
      vinaigre_banane:       { prix_litre_eur: 8 },
    },
    changelog: [
      { date: '2026-05-14', modification: 'Création initiale', auteur: 'Tropical Autonome' },
    ],
  },
};

const marcheLocal = {
  version:          '1.0',
  last_verified:    '2026-05-14',
  update_frequency: 'weekly',
  source_type:      'market_data',
  sources: [
    { name: 'DAAF Guadeloupe — relevés prix marchés 2025-2026' },
    { name: 'OPMR (Observatoire des Prix, des Marges et des Revenus)' },
  ],
  disclaimer: 'Prix relevés semaine du 12 mai 2026 — varient selon météo et arrivages.',
  data: {
    semaine_releve: '2026-W20',
    marches_couverts: ['Pointe-à-Pitre (Saint-Antoine)', 'Basse-Terre (Marché Couvert)', 'Le Moule'],
    prix_legumes_eur_kg: {
      concombre: 0.90, tomate_locale: 2.20, igname_jaune: 2.80,
      dachine: 1.50, christophine: 1.20, piment_antillais: 5.00,
      giraumon: 1.80, aubergine: 1.60,
    },
    prix_fruits_eur_kg: {
      mangue_julie: 1.50, ananas_victoria: 2.00, papaye: 1.20,
      goyave: 2.50, maracudja: 3.50, corossol: 2.80,
    },
    tendances_semaine: {
      hausse:  ['tomate_locale (+15%)', 'piment_antillais (+8%)'],
      baisse:  ['mangue_julie (-12% — pic production)'],
      stable:  ['igname', 'dachine', 'concombre'],
    },
    changelog: [
      { date: '2026-05-14', modification: 'Création initiale — semaine 20/2026', auteur: 'Tropical Autonome' },
    ],
  },
};

// ─── Helper KV via fichier temporaire ────────────────────────────────

function kvPut(namespaceId, key, value) {
  const tmp = join(tmpdir(), `kv-seed-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  try {
    execSync(
      `npx wrangler kv key put --namespace-id="${namespaceId}" "${key}" --path="${tmp}"`,
      { stdio: 'inherit' }
    );
  } finally {
    unlinkSync(tmp);
  }
}

// ─── Exécution ───────────────────────────────────────────────────────

console.log('\n🌴 Seed fournisseur test — Agri Guadeloupe\n');

console.log('📦 DATA_STORE — données endpoints...');
kvPut(DATA_NS, 'agri-filieres-banane', filieresBanane);
console.log('  ✓ agri-filieres-banane');
kvPut(DATA_NS, 'agri-marche-local', marcheLocal);
console.log('  ✓ agri-marche-local');

console.log('\n🏪 PROVIDERS_STORE — fournisseur + index...');
kvPut(PROVIDERS_NS, 'provider:agri-guadeloupe', provider);
console.log('  ✓ provider:agri-guadeloupe');
kvPut(PROVIDERS_NS, 'providers:index', ['agri-guadeloupe']);
console.log('  ✓ providers:index');

console.log('\n✅ Fournisseur test créé !');
console.log('\n── Étape suivante ──────────────────────────────────────────');
console.log('Définir la clé fournisseur (pour tester le ledger/settle) :');
console.log('  npx wrangler secret put PROVIDER_KEY_agri_guadeloupe');
console.log('\nVérifier :');
console.log('  GET /marketplace/v1                   → doit afficher 1 fournisseur');
console.log('  GET /marketplace/v1/agri-guadeloupe   → carte du fournisseur');
console.log('  GET /marketplace/v1/agri-guadeloupe/filieres-banane → 402 (prix 0.040 USDC)');
console.log('  GET /marketplace/v1/agri-guadeloupe/marche-local    → 402 (prix 0.020 USDC)\n');
