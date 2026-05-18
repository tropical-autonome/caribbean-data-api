/**
 * Middleware x402 — Vérification paiement USDC
 * 
 * Retourne null si le paiement est valide (continuer)
 * Retourne une Response 402 si paiement manquant ou invalide
 */

import { PRICING } from '../config/pricing.js';

export async function handleX402(request, env, priceKey, endpoint) {
  const price = PRICING[priceKey];
  const paymentHeader = request.headers.get('X-Payment');

  // Pas de header de paiement → répondre 402 avec le prix
  if (!paymentHeader) {
    return payment402Response(price, endpoint, env);
  }

  // Vérifier la transaction on-chain
  const isValid = await verifyPayment(paymentHeader, price, env);

  if (!isValid) {
    return new Response(JSON.stringify({
      error: 'PAYMENT_INVALID',
      message: 'Transaction invalide, expirée ou montant insuffisant',
      price,
      currency: 'USDC',
      network: 'base'
    }), {
      status: 402,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Paiement OK → retourner null pour continuer vers le handler
  return null;
}

function payment402Response(price, endpoint, env) {
  return new Response(JSON.stringify({
    error: 'Payment Required',
    price,
    currency: 'USDC',
    network: 'base',
    address: env.PAYMENT_WALLET_ADDRESS,
    endpoint,
    instructions: 'Envoyez le montant exact en USDC sur Base network, puis incluez le hash de transaction dans le header X-Payment de votre prochaine requête.',
    x402_version: '1.0'
  }), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Price': price,
      'X-Payment-Currency': 'USDC',
      'X-Payment-Network': 'base'
    }
  });
}

async function verifyPayment(txHash, expectedPrice, env) {
  // TODO: intégrer vérification on-chain via Base RPC
  // Pour le développement initial : mode passthrough (accepter toutes les tx)
  // En production : vérifier via Base RPC que :
  //   1. La transaction existe et est confirmée
  //   2. Le montant = expectedPrice USDC
  //   3. Le destinataire = env.PAYMENT_WALLET_ADDRESS
  //   4. La transaction n'a pas déjà été utilisée (replay protection)

  if (env.ENVIRONMENT === 'development') {
    console.log(`[DEV MODE] Paiement accepté sans vérification: ${txHash}`);
    return true;
  }

  // Production : implémenter ici la vérification Base RPC
  // Voir: https://docs.base.org/tools/node-providers
  try {
    // Placeholder — Claude Code devra implémenter cette partie
    // avec le SDK viem ou ethers.js pour vérifier on-chain
    return txHash.startsWith('0x') && txHash.length === 66;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
}
