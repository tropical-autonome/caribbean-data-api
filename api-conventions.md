# Règles — Conventions API

## Format de réponse standard
Tous les endpoints retournent ce format JSON :

```json
{
  "success": true,
  "endpoint": "/api/v1/edf-oa/tarifs-zni",
  "data": { ... },
  "meta": {
    "last_verified": "2026-05-01",
    "source": "EDF SEI / CRE",
    "zone": "971 - Guadeloupe",
    "update_frequency": "quarterly"
  },
  "disclaimer": "Données à titre informatif. Vérifier auprès des autorités compétentes avant toute décision d'investissement."
}
```

## Routes
- Toujours préfixer par `/api/v1/`
- Noms en kebab-case (ex: `tarifs-zni`, pas `tarifsZni`)
- Méthode GET pour données statiques
- Méthode POST pour analyses (paramètres en body JSON)

## Headers obligatoires sur chaque réponse
```
Content-Type: application/json
X-Powered-By: Tropical Autonome Data API
X-Data-Version: 1.0
Access-Control-Allow-Origin: *
```

## Gestion des erreurs
```json
{
  "success": false,
  "error": "ENDPOINT_NOT_FOUND",
  "message": "Description lisible de l'erreur",
  "code": 404
}
```

## Codes d'erreur métier
- `PAYMENT_REQUIRED` → 402 (pas encore payé)
- `PAYMENT_INVALID` → 402 (paiement invalide)
- `DATA_NOT_FOUND` → 404
- `PARAM_MISSING` → 400 (paramètre POST manquant)
- `INTERNAL_ERROR` → 500

## Nouveau endpoint — checklist
Quand tu crées un nouvel endpoint, tu dois :
1. Créer le handler dans `src/handlers/`
2. Ajouter la route dans `src/index.js`
3. Ajouter le prix dans `src/config/pricing.js`
4. Créer / mettre à jour le fichier JSON dans `data/`
5. Ajouter l'endpoint dans `llms.txt`
6. Ajouter la doc dans `docs/README.md`
