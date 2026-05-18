# Règles — Middleware x402 Payments

## Principe du protocole
1. Client envoie GET/POST sur l'endpoint
2. Si pas de header de paiement → répondre HTTP 402 avec `{ price, currency, network, address }`
3. Client paie on-chain et renvoie avec header `X-Payment: <transaction_hash>`
4. Middleware vérifie la transaction → si valide, continuer vers le handler
5. Handler retourne les données

## Structure du header 402
```json
{
  "error": "Payment Required",
  "price": "0.005",
  "currency": "USDC",
  "network": "base",
  "address": "WALLET_ADDRESS_FROM_ENV",
  "endpoint": "/api/v1/edf-oa/tarifs-zni",
  "description": "Tarifs EDF OA Zone Non Interconnectée"
}
```

## Règles de code
- Le wallet address vient toujours de `env.PAYMENT_WALLET_ADDRESS` (jamais hardcodé)
- Les prix viennent toujours de `src/config/pricing.js` (jamais hardcodés dans les handlers)
- Toujours logger les transactions dans Cloudflare Analytics
- Timeout de vérification transaction : 10 secondes maximum
- En cas d'erreur de vérification : retourner 402, jamais 500

## Pricing config (src/config/pricing.js)
```javascript
export const PRICING = {
  'edf-oa-tarifs-zni':      '0.005',
  'raccordement-guadeloupe': '0.010',
  'analyse-rentabilite':     '0.500',
  'fiscalite-244w':          '0.010',
  'financement-dom':         '0.010',
  'cession-projet':          '0.050',
  'ecologie-ressources':     '0.005',
  'blue-economy':            '0.020',
}
```
