# TROPICAL DATA API — Claude Code Memory
**Dernière mise à jour : 13 mai 2026**

## Projet
API de données structurées monétisées via le protocole HTTP 402 (x402).
Les agents IA paient automatiquement en USDC pour accéder aux données.
Producteur : Frederick Martel — Tropical Autonome — Lamentin, Guadeloupe (971).

## Stack technique
- **Runtime** : Cloudflare Workers (Node.js compatible)
- **Config** : wrangler.toml
- **Base de données** : Cloudflare KV (données statiques JSON)
- **Paiement** : SDK x402 Coinbase — USDC sur Base network
- **Agent IA** : Claude API (claude-sonnet-4-20250514) pour endpoints d'analyse
- **Déploiement** : `npm run deploy` → Cloudflare Workers

## Commandes essentielles
```bash
npm run dev          # Serveur local wrangler dev
npm run deploy       # Déploiement Cloudflare Workers
npm run test         # Tests Jest
npm run lint         # ESLint
npm run seed         # Peupler Cloudflare KV avec les données JSON
npm run validate     # Valider la structure des fichiers JSON data/
```

## Structure du projet
```
tropical-data-api/
├── CLAUDE.md                          ← CE FICHIER — lire en premier
├── .claude/
│   └── rules/
│       ├── data-quality.md            ← Règles qualité données (LIRE)
│       ├── x402-payments.md           ← Règles middleware paiement (LIRE)
│       └── api-conventions.md         ← Conventions API (LIRE)
├── src/
│   ├── index.js                       ← Router principal
│   ├── middleware/
│   │   └── x402.js                    ← Middleware paiement HTTP 402
│   ├── config/
│   │   └── pricing.js                 ← PRIX — source unique de vérité
│   └── handlers/
│       ├── edf-oa.js                  ← FAIT — Tarifs EDF OA ZNI
│       ├── raccordement.js            ← A FAIRE
│       ├── analyse.js                 ← A FAIRE (Claude API)
│       ├── fiscalite-244w.js          ← PRIORITE 1
│       ├── financement-dom.js         ← PRIORITE 1
│       ├── cession.js                 ← A FAIRE
│       ├── caye-vanille.js            ← PRIORITE 2
│       ├── caye-vetiver.js            ← PRIORITE 2
│       ├── caye-marche-premium.js     ← PRIORITE 2
│       ├── biodiversite-guadeloupe.js ← PRIORITE 3
│       ├── edna-caraibes.js           ← PRIORITE 3
│       └── credits-biodiversite.js    ← PRIORITE 3
├── data/
│   ├── tarifs-edf-oa.json             ← FAIT
│   ├── raccordement-steps.json        ← A CREER
│   ├── fiscalite-244w.json            ← PRIORITE 1
│   ├── financement-dom.json           ← PRIORITE 1
│   ├── caye-vanille.json              ← PRIORITE 2
│   ├── caye-vetiver.json              ← PRIORITE 2
│   ├── caye-marche-caraibes.json      ← PRIORITE 2
│   ├── biodiversite-guadeloupe.json   ← PRIORITE 3
│   ├── edna-especes.json              ← PRIORITE 3
│   └── credits-biodiversite.json      ← PRIORITE 3
├── llms.txt                           ← FAIT — mettre a jour a chaque nouvel endpoint
├── wrangler.toml                      ← FAIT
└── package.json                       ← FAIT
```

---

## PRIORITES IMMEDIATES — Dans cet ordre

### PRIORITE 1 — Fiscalite & Financement DOM
Demande maximale des agents finance/investissement. Donnees inexistantes en JSON.

**fiscalite-244w.json doit contenir :**
- Taux du credit d'impot (38.25% base)
- Conditions d'eligibilite (entreprise soumise IS/IR, investissement productif DOM)
- Plafond de base de calcul
- Mecanisme de retrocession (minimum legal 52.63% a l'entreprise locale)
- Procedure de demande (formulaire 2069-RCI)
- Delais de remboursement
- Cas pratiques : cession de projet solaire avec 244W
- Sources : BOFiP, CGI Art. 244 quater W

**financement-dom.json doit contenir :**
- Cheque TIC Region Guadeloupe (montant, conditions, delais)
- BPI France DOM (garanties, prets innovation, criteres specifiques)
- ADEME subventions insulaires
- FEDER 2021-2027 Guadeloupe (axes prioritaires, taux cofinancement)
- Conditions de cumul des aides (regle de minimis 200 000€ / 3 ans)
- Delais et procedures reels terrain

---

### PRIORITE 2 — Produits Caribeens Premium (CAYE)
Marche vanille mondial 2 milliards$ (+76% en 2024). Agents acheteurs premium cherchent
donnees producteurs caribeens — inexistant en JSON. Marches cibles : Dubai, Europe, US.

**caye-vanille.json doit contenir :**
- Prix vanille Guadeloupe vs Madagascar vs Tahiti (comparatif USD/kg)
- Calendrier de recolte et floraison en Guadeloupe
- Certifications disponibles (bio, equitable)
- Profil aromatique specifique vanille caribeenne
- Canaux de vente premium (Dubai, Europe, US)
- Prix de gros actuel + historique 5 ans

**caye-vetiver.json doit contenir :**
- Prix huile essentielle vetiver caribeenne vs haitienne vs indienne
- Differentiation profil olfactif (parfumerie luxe)
- Potentiel Guadeloupe comme producteur
- Marche global vetiver Caraibes (Haiti leader, 153 shipments)

**caye-marche-caraibes.json doit contenir :**
- Vue marche global produits agro-transformation premium Caraibes
- Cacao, miel, sel de mer, beurre de cacao (prix, certifications, marches)
- Opportunites Dubai / Moyen-Orient specifiques

---

### PRIORITE 3 — Biodiversite Caraibes
Credits biodiversite en explosion. Agents ESG fonds cherchent donnees terrain.
Guadeloupe = 1 des 34 hotspots mondiaux. 6% biodiversite nationale francaise.

**biodiversite-guadeloupe.json doit contenir :**
- 10 600 especes natives inventoriees
- Especes endemiques par categorie
- Ecosystemes (foret seche, tropicale, mangrove, recifs)
- Zones protegees et contraintes reglementaires
- Sources : ARB Guadeloupe, DEAL, Parc National

**edna-especes.json doit contenir :**
- Donnees eDNA marines cote ouest Guadeloupe (etude MNHN 2021-2022)
- 300+ especes poissons + 21 especes cetaces documentees
- Methodologie eDNA applicable (protocole, equipements)
- Lien dataset GBIF public : https://obis.org/dataset/2b47cfee-0233-4bd8-8f12-58a2fc3c5556

**credits-biodiversite.json doit contenir :**
- Mecanismes credits biodiversite (TNFD, Kunming-Montreal)
- Standards certification (Plan Vivo, Verra biodiversity)
- Prix marche credits biodiversite (USD/unite)
- Applicabilite ecosystemes caribeens
- Connexion NatureMetrics (eDNA + bioacoustique)

---

## Contexte domaine — vocabulaire cle

### Energie solaire DOM
- ZNI = Zone Non Interconnectee (971, 972, 974, 976)
- EDF OA = Obligation d'Achat — contrat 20 ans, tarif ~0.18€/kWh
- EDF SEI = Systemes Energetiques Insulaires (filiale EDF DOM)
- CRE = Commission de Regulation de l'Energie
- kWc = kilowatt-crete (puissance), kWh = energie produite
- RGE = Reconnu Garant de l'Environnement

### Fiscalite DOM
- Article 244 quater W CGI = credit d'impot investissement DOM (38.25%)
- BOFiP = Bulletin Officiel des Finances Publiques
- Retrocession = min 52.63% credit d'impot beneficie a l'entreprise locale
- Minimis = plafond aides d'Etat cumulees (200 000€ / 3 ans)

### Produits CAYE
- CAYE = marque agro-transformation premium caribeenne (Frederick Martel)
- Produits : vanille, vetiver, miel, cacao, beurre de cacao, sel de mer
- Marches cibles : Dubai, Europe premium, US premium

### Biodiversite
- eDNA = ADN environnemental (detection especes par traces dans eau/sol)
- Bioacoustique = detection especes par analyse sonore
- NatureMetrics = partenaire outils eDNA et bioacoustique
- TNFD = Taskforce on Nature-related Financial Disclosures
- Hotspot = zone haute concentration especes endemiques menacees

### x402
- x402 = protocole HTTP 402 paiement automatique machine-to-machine
- USDC = stablecoin dollar sur Base network (L2 Ethereum)
- llms.txt = fichier decouverte pour agents IA

---

## Regles absolues
- Ne jamais exposer les cles API dans le code (utiliser wrangler secret put)
- Chaque JSON doit avoir last_verified (date ISO) et sources[]
- Chaque endpoint doit retourner un champ disclaimer
- Les prix x402 sont definis UNIQUEMENT dans src/config/pricing.js
- Quand un endpoint est cree → mettre a jour llms.txt obligatoirement
- Donnees terrain = indiquer source_type field_experience + periode observee

---

## Enrichissement continu
Quand tu travailles sur ce projet tu dois :
- Creer les handlers manquants (PRIORITE 1 d'abord)
- Enrichir les fichiers JSON dans data/ avec donnees sourcees
- Mettre a jour llms.txt a chaque nouvel endpoint actif
- Verifier et mettre a jour last_verified si donnees perimees
- Ajouter entrees dans data.changelog[] a chaque modification

@.claude/rules/x402-payments.md
@.claude/rules/api-conventions.md
@.claude/rules/data-quality.md
