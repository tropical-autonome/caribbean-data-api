/**
 * Middleware x402 — Vérification paiement USDC
 *
 * Deux modes :
 *   - operatorPayment : endpoint Tropical Autonome → paiement direct
 *   - marketplacePayment : endpoint fournisseur tiers → enregistre dans le ledger
 *
 * Retourne null si le paiement est valide (continuer vers le handler).
 * Retourne une Response 402 si paiement manquant ou invalide.
 */

import { PRICING, marketplacePrice } from '../config/pricing.js';
import { creditLedger } from '../marketplace/commission.js';

// ─── Opérateur — endpoints Tropical Autonome ────────────────────────

export async function handleX402(request, env, priceKey, endpoint) {
  const price         = PRICING[priceKey];
  const paymentHeader = request.headers.get('X-Payment');

  if (!paymentHeader) {
    return payment402Response(price, endpoint, env.PAYMENT_WALLET_ADDRESS, 'operator');
  }

  const isValid = await verifyPayment(paymentHeader, price, env);
  if (!isValid) {
    return invalidPaymentResponse(price);
  }

  return null;
}

// ─── Marketplace — endpoints fournisseurs tiers ──────────────────────

/**
 * Vérifie le paiement pour un endpoint de fournisseur tiers.
 * Si valide, enregistre la part fournisseur dans le ledger.
 *
 * @param {Request} request
 * @param {Object}  env           - Cloudflare env bindings
 * @param {Object}  provider      - registre fournisseur (depuis KV)
 * @param {Object}  endpointDef   - définition de l'endpoint fournisseur
 * @param {string}  endpointPath  - chemin complet pour la réponse 402
 * @returns {Response|null}
 */
export async function handleMarketplaceX402(request, env, provider, endpointDef, endpointPath) {
  const { total, providerShare, commissionShare } = marketplacePrice(endpointDef.price_usdc);
  const paymentHeader = request.headers.get('X-Payment');

  if (!paymentHeader) {
    return payment402Response(total, endpointPath, env.PAYMENT_WALLET_ADDRESS, 'marketplace', {
      provider: provider.slug,
      provider_name: provider.name,
      provider_share_usdc: providerShare,
      commission_usdc: commissionShare,
    });
  }

  const isValid = await verifyPayment(paymentHeader, total, env);
  if (!isValid) {
    return invalidPaymentResponse(total);
  }

  // Paiement valide → créditer la part fournisseur dans le ledger
  // Opération non bloquante (waitUntil pour ne pas retarder la réponse)
  const creditOp = creditLedger(env, provider.slug, providerShare, {
    endpoint:    endpointPath,
    tx_hash:     paymentHeader,
    total_paid:  total,
    commission:  commissionShare,
    timestamp:   new Date().toISOString(),
  });

  if (env.ctx?.waitUntil) {
    env.ctx.waitUntil(creditOp);
  } else {
    await creditOp;
  }

  return null;
}

// ─── Vérification on-chain ───────────────────────────────────────────

// Adresse du contrat USDC sur Base mainnet
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Signature de l'event ERC-20 Transfer(address,address,uint256)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// KV key prefix pour replay protection
const TX_USED_PREFIX = 'tx_used:';

// TTL replay protection : 90 jours (les tx sont permanentes mais on garde 90j)
const REPLAY_TTL_SEC = 90 * 24 * 60 * 60;

async function verifyPayment(txHash, expectedPrice, env) {
  if (env.ENVIRONMENT === 'development') {
    console.log(`[DEV] Paiement accepté sans vérification: ${txHash}`);
    return true;
  }

  // Validation format basique
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) return false;

  // Replay protection — tx déjà utilisée ?
  const usedKey = `${TX_USED_PREFIX}${txHash.toLowerCase()}`;
  const alreadyUsed = await env.LEDGER_STORE.get(usedKey);
  if (alreadyUsed) {
    console.warn(`[x402] Replay attack détecté: ${txHash}`);
    return false;
  }

  // Récupérer le reçu de transaction via Base RPC
  const receipt = await getTransactionReceipt(txHash, env);
  if (!receipt) return false;

  // Transaction confirmée ?
  if (receipt.status !== '0x1') return false;

  // Chercher un log Transfer USDC vers notre wallet
  const walletLower    = (env.PAYMENT_WALLET_ADDRESS || '').toLowerCase();
  const expectedAmount = usdcToWei(expectedPrice);

  const validTransfer = receipt.logs?.some(log => {
    if (log.address?.toLowerCase() !== USDC_CONTRACT.toLowerCase()) return false;
    if (log.topics?.[0] !== TRANSFER_TOPIC) return false;

    // topics[2] = adresse destinataire (paddée sur 32 bytes)
    const toAddress = '0x' + (log.topics[2] || '').slice(26);
    if (toAddress.toLowerCase() !== walletLower) return false;

    // data = montant uint256 en hex
    const amount = BigInt(log.data || '0x0');
    const expected = BigInt(expectedAmount);

    // Accepter si le montant est >= attendu (tolérance 0)
    return amount >= expected;
  });

  if (!validTransfer) return false;

  // Marquer la tx comme utilisée (replay protection)
  await env.LEDGER_STORE.put(usedKey, '1', { expirationTtl: REPLAY_TTL_SEC });

  return true;
}

async function getTransactionReceipt(txHash, env) {
  const rpcUrl = env.BASE_RPC_URL || 'https://mainnet.base.org';

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method:  'eth_getTransactionReceipt',
        params:  [txHash],
        id:      1,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.result ?? null;
  } catch (err) {
    console.error('[x402] Erreur RPC Base:', err.message);
    return null;
  }
}

// Convertit un montant USDC (string "0.020") en unités (6 décimales)
// ex: "0.020" → "20000"
function usdcToWei(priceUsdc) {
  const amount = parseFloat(priceUsdc);
  return Math.round(amount * 1_000_000).toString();
}

// ─── Helpers réponses ────────────────────────────────────────────────

function payment402Response(price, endpoint, walletAddress, mode, extra = {}) {
  const body = {
    error:        'Payment Required',
    price_usdc:   price,
    currency:     'USDC',
    network:      'base',
    address:      walletAddress,
    endpoint,
    mode,
    instructions: 'Envoyez le montant exact en USDC sur Base network, puis incluez le hash de transaction dans le header X-Payment.',
    x402_version: '1.0',
    ...extra,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 402,
    headers: {
      'Content-Type':         'application/json',
      'X-Payment-Price':      price,
      'X-Payment-Currency':   'USDC',
      'X-Payment-Network':    'base',
      'X-Payment-Address':    walletAddress || '',
    }
  });
}

function invalidPaymentResponse(price) {
  return new Response(JSON.stringify({
    error:   'PAYMENT_INVALID',
    message: 'Transaction invalide, expirée ou montant insuffisant',
    price_usdc: price,
    currency: 'USDC',
    network:  'base'
  }), {
    status: 402,
    headers: { 'Content-Type': 'application/json' }
  });
}
