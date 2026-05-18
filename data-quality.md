# Règles — Qualité des données

## Principe fondamental
Les données de cette API sont vendues à des agents IA qui prennent des décisions.
Une donnée fausse ou périmée = perte de confiance = perte de revenus.
La qualité est non-négociable.

## Structure obligatoire des fichiers JSON (data/)
```json
{
  "version": "1.2",
  "last_verified": "2026-05-01",
  "verified_by": "Frederick Martel — Tropical Autonome",
  "sources": [
    {
      "name": "CRE - Commission de Régulation de l'Énergie",
      "url": "https://www.cre.fr",
      "consulted": "2026-05-01"
    }
  ],
  "update_frequency": "quarterly",
  "next_review": "2026-08-01",
  "data": { ... }
}
```

## Règles de mise à jour
- Ne jamais modifier une donnée sans mettre à jour `last_verified`
- Si une donnée est incertaine → ajouter `"confidence": "medium"` ou `"low"`
- Si une donnée a changé → incrémenter `version` (ex: 1.1 → 1.2)
- Toujours garder l'ancienne valeur dans `data.history[]` avec date

## Données tarifaires (tarifs EDF OA)
- Source de vérité : délibérations CRE publiées au Journal Officiel
- Fréquence de vérification : trimestrielle (janvier, avril, juillet, octobre)
- Tolérance d'écart : 0% (les tarifs sont exacts ou on ne les publie pas)

## Données réglementaires (fiscalité, financement)
- Source de vérité : textes CGI, BOFiP, arrêtés préfectoraux
- Fréquence de vérification : annuelle (après loi de finances)
- Tolérance : mentionner explicitement si "en cours de modification"

## Données terrain (raccordement, délais)
- Ces données sont basées sur l'expérience terrain de Frederick Martel
- Toujours indiquer `"source_type": "field_experience"` (pas source officielle)
- Indiquer la période d'observation : `"observed_period": "2022-2026"`

## Enrichissement
Quand tu enrichis les données existantes :
1. Vérifier la source avant d'ajouter
2. Ajouter la source dans `sources[]`
3. Mettre à jour `last_verified` et `version`
4. Ajouter une entrée dans `data.changelog[]`
