/**
 * Commission Ledger — Suivi des reversements fournisseurs
 *
 * Architecture :
 *   - L'agent paie le montant total à l'adresse de Tropical Autonome
 *   - Le ledger trace la part fournisseur (75%) à reverser
 *   - Le fournisseur appelle POST /marketplace/v1/{slug}/settle pour demander un paiement
 *   - L'opérateur effectue le virement USDC hors-chaîne ou via script
 *
 * Stockage Cloudflare KV (binding : LEDGER_STORE)
 *
 * Schéma KV :
 *   ledger:{slug}         → état du compte fournisseur
 *   ledger:tx:{txHash}    → replay protection (expire 30j)
 *   ledger:ops:{slug}     → liste des 100 dernières opérations (FIFO)
 *
 * Schéma ledger:
 * {
 *   provider_slug:     string,
 *   pending_usdc:      string,   // montant à reverser (non encore payé)
 *   total_earned_usdc: string,   // cumulatif brut
 *   total_paid_usdc:   string,   // cumulatif reversé
 *   last_updated:      string,   // ISO date
 *   settlement_count:  number
 * }
 */

const LEDGER_PREFIX = 'ledger:';
const TX_PREFIX     = 'ledger:tx:';
const OPS_PREFIX    = 'ledger:ops:';
const TX_TTL_SEC    = 30 * 24 * 60 * 60;   // 30 jours replay protection
const MAX_OPS       = 100;

// ─── Créditer le ledger après un paiement validé ─────────────────────

/**
 * Enregistre la part fournisseur dans le ledger.
 * Appelé par le middleware x402 après validation du paiement.
 *
 * @param {Object} env            - Cloudflare env bindings
 * @param {string} providerSlug
 * @param {string} providerShare  - montant USDC à reverser au fournisseur
 * @param {Object} opMeta         - métadonnées de l'opération (endpoint, tx_hash…)
 */
export async function creditLedger(env, providerSlug, providerShare, opMeta = {}) {
  // Replay protection
  if (opMeta.tx_hash) {
    const alreadySeen = await env.LEDGER_STORE.get(`${TX_PREFIX}${opMeta.tx_hash}`);
    if (alreadySeen) {
      console.warn(`[LEDGER] tx déjà traitée: ${opMeta.tx_hash}`);
      return;
    }
    await env.LEDGER_STORE.put(
      `${TX_PREFIX}${opMeta.tx_hash}`,
      providerSlug,
      { expirationTtl: TX_TTL_SEC }
    );
  }

  const key    = `${LEDGER_PREFIX}${providerSlug}`;
  const ledger = await env.LEDGER_STORE.get(key, { type: 'json' }) ?? emptyLedger(providerSlug);

  const prev    = parseFloat(ledger.pending_usdc);
  const earned  = parseFloat(ledger.total_earned_usdc);
  const share   = parseFloat(providerShare);

  ledger.pending_usdc      = (prev + share).toFixed(6);
  ledger.total_earned_usdc = (earned + share).toFixed(6);
  ledger.last_updated      = new Date().toISOString();

  await env.LEDGER_STORE.put(key, JSON.stringify(ledger));

  // Journaliser l'opération
  await appendOperation(env, providerSlug, {
    type:           'credit',
    amount_usdc:    providerShare,
    endpoint:       opMeta.endpoint   ?? '',
    tx_hash:        opMeta.tx_hash    ?? '',
    total_paid:     opMeta.total_paid ?? '',
    commission:     opMeta.commission ?? '',
    timestamp:      opMeta.timestamp  ?? new Date().toISOString(),
  });
}

// ─── Demande de reversement (settlement) ─────────────────────────────

/**
 * Enregistre une demande de reversement et remet le compteur pending à 0.
 * L'opérateur effectue ensuite le virement réel hors de ce Worker.
 *
 * @returns {{ settlement_id, amount_usdc, wallet_address }}
 */
export async function requestSettlement(env, providerSlug, walletAddress) {
  const key    = `${LEDGER_PREFIX}${providerSlug}`;
  const ledger = await env.LEDGER_STORE.get(key, { type: 'json' }) ?? emptyLedger(providerSlug);

  const pending = parseFloat(ledger.pending_usdc);
  if (pending < 0.000001) throw new Error('NOTHING_TO_SETTLE: solde nul');

  const settlementId = `SET-${providerSlug}-${Date.now()}`;
  const amount       = ledger.pending_usdc;

  ledger.pending_usdc   = '0.000000';
  ledger.total_paid_usdc = (parseFloat(ledger.total_paid_usdc) + pending).toFixed(6);
  ledger.last_updated   = new Date().toISOString();
  ledger.settlement_count = (ledger.settlement_count ?? 0) + 1;

  await env.LEDGER_STORE.put(key, JSON.stringify(ledger));

  await appendOperation(env, providerSlug, {
    type:          'settlement_request',
    amount_usdc:   amount,
    settlement_id: settlementId,
    wallet:        walletAddress,
    timestamp:     new Date().toISOString(),
  });

  return { settlement_id: settlementId, amount_usdc: amount, wallet_address: walletAddress };
}

// ─── Lecture ─────────────────────────────────────────────────────────

export async function getLedger(env, providerSlug) {
  const key = `${LEDGER_PREFIX}${providerSlug}`;
  return await env.LEDGER_STORE.get(key, { type: 'json' }) ?? emptyLedger(providerSlug);
}

export async function getOperations(env, providerSlug) {
  const key = `${OPS_PREFIX}${providerSlug}`;
  return await env.LEDGER_STORE.get(key, { type: 'json' }) ?? [];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function emptyLedger(slug) {
  return {
    provider_slug:     slug,
    pending_usdc:      '0.000000',
    total_earned_usdc: '0.000000',
    total_paid_usdc:   '0.000000',
    last_updated:      new Date().toISOString(),
    settlement_count:  0,
  };
}

async function appendOperation(env, providerSlug, op) {
  const key = `${OPS_PREFIX}${providerSlug}`;
  const ops = await env.LEDGER_STORE.get(key, { type: 'json' }) ?? [];

  ops.unshift(op);
  if (ops.length > MAX_OPS) ops.length = MAX_OPS;

  await env.LEDGER_STORE.put(key, JSON.stringify(ops));
}
