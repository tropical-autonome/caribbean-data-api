# Tropical Autonome — Caribbean Data API

**MCP server + REST API** providing structured Caribbean data for AI agents.  
Payments via [x402 protocol](https://x402.org) — USDC on Base network (L2 Ethereum).

## MCP Server

```
https://tropical-data-api.tropicalautonome.workers.dev/mcp
```

Protocol: MCP 2024-11-05 — Streamable HTTP  
**22 tools** (3 free + 19 paid)

### Add to Claude Code

```bash
claude mcp add --transport http tropical-caribbean-data \
  https://tropical-data-api.tropicalautonome.workers.dev/mcp
```

### Free tools (no payment required)

| Tool | Description |
|------|-------------|
| `caribbean_list_marketplace` | List all active providers and endpoints |
| `caribbean_get_provider` | Get full provider card with prices |
| `caribbean_get_llms_txt` | Discovery overview — start here |

### Paid tools (USDC on Base)

| Tool | Data | Price |
|------|------|-------|
| `caribbean_get_edf_oa_tarifs` | EDF solar feed-in tariffs (ZNI DOM) | 0.005 USDC |
| `caribbean_get_irradiation_dom` | Solar irradiation by commune (GHI/PVOUT) | 0.010 USDC |
| `caribbean_get_raccordement` | Grid connection procedure Guadeloupe | 0.010 USDC |
| `caribbean_get_fiscalite_244w` | Tax credit 244W DOM (38.25%) | 0.020 USDC |
| `caribbean_get_financement_dom` | Financing schemes DOM (FEDER, BPI, ADEME) | 0.020 USDC |
| `caribbean_get_pme_guadeloupe` | SME profiles Guadeloupe (42,000 businesses) | 0.020 USDC |
| `caribbean_get_peche_artisanale` | Artisanal fishing Caribbean (prices, species, regs) | 0.020 USDC |
| `caribbean_get_eau_dom` | Water & sanitation DOM (SMGEAG, tenders) | 0.020 USDC |
| `caribbean_get_biodiversite` | Guadeloupe biodiversity hotspot (10,600 species) | 0.010 USDC |
| `caribbean_get_edna` | eDNA marine data MNHN 2021-2022 | 0.020 USDC |
| `caribbean_get_tourisme_guadeloupe` | Sustainable tourism (870k visitors, eco-labels) | 0.025 USDC |
| `caribbean_get_foncier_agricole` | Agricultural land DOM (prices, agrivoltaism) | 0.030 USDC |
| `caribbean_get_caye_vanille` | Caribbean vanilla market vs Madagascar/Tahiti | 0.030 USDC |
| `caribbean_get_import_export` | Caribbean trade flows + Dubai export opportunities | 0.030 USDC |
| `caribbean_get_caye_vetiver` | Vetiver essential oil Caribbean vs Haiti/India | 0.030 USDC |
| `caribbean_get_caye_marche` | Premium agro-processing Caribbean market | 0.050 USDC |
| `caribbean_get_credits_biodiversite` | Biodiversity credits (TNFD, Plan Vivo, Verra) | 0.050 USDC |
| `caribbean_analyse_solaire` | AI solar profitability analysis (Claude) | 0.500 USDC |
| `caribbean_get_marketplace_data` | Access third-party provider data | varies |

## REST API

**Base URL:** `https://tropical-data-api.tropicalautonome.workers.dev`

### Payment flow (x402 protocol)

```bash
# 1. Call endpoint → receive 402 with price and wallet
curl https://tropical-data-api.tropicalautonome.workers.dev/api/v1/edf-oa/tarifs-zni

# 2. Send USDC on Base network to the wallet address

# 3. Retry with transaction hash
curl -H "X-Payment: 0x{tx_hash}" \
  https://tropical-data-api.tropicalautonome.workers.dev/api/v1/edf-oa/tarifs-zni
```

### Discovery

| Endpoint | Description |
|----------|-------------|
| `GET /` | Full endpoint catalogue |
| `GET /llms.txt` | AI agent discovery file |
| `GET /openapi.json` | OpenAPI 3.1 specification |
| `GET /mcp` | MCP server info |
| `GET /marketplace/v1` | Third-party providers catalogue |

## Stack

- **Runtime:** Cloudflare Workers
- **Storage:** Cloudflare KV (3 namespaces)
- **Payment:** x402 protocol — USDC on Base network
- **AI analysis:** Anthropic Claude API
- **MCP:** Protocol 2024-11-05, Streamable HTTP

## Data coverage

Caribbean territories: Guadeloupe (971), Martinique (972), La Réunion (974), Mayotte (976), Saint-Martin, Marie-Galante, Les Saintes, La Désirade.

Topics: Solar energy · Biodiversity · Fishing · Agriculture · Land · Tourism · Trade · Water infrastructure · SME intelligence · Premium products (vanilla, vetiver, cacao).

## Contact

**Operator:** Frederick Martel — Tropical Autonome  
**Location:** Lamentin, Guadeloupe (971), France  
**Email:** tropicalautonome@gmail.com  
**API:** https://tropical-data-api.tropicalautonome.workers.dev
