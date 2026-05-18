/**
 * Handler — Fiscalité Article 244 quater W CGI
 * GET /api/v1/fiscalite/244-quater-w
 */

export async function handleFiscalite(request, env) {
  let data = await env.DATA_STORE.get('fiscalite-244w', { type: 'json' });

  if (!data) data = getStaticData();

  return {
    data: data.data,
    meta: {
      last_verified:    data.last_verified,
      sources:          data.sources,
      update_frequency: data.update_frequency,
      version:          data.version,
    },
    disclaimer: data.disclaimer,
  };
}

function getStaticData() {
  return {
    version:          '1.0',
    last_verified:    '2026-05-14',
    update_frequency: 'annual',
    sources: [{ name: 'BOFiP — BOI-BIC-RICI-20-10-10-20' }, { name: 'CGI Art. 244 quater W' }],
    disclaimer: "Données à titre informatif. Consulter un expert-comptable avant tout investissement.",
    data: {
      nom:         'Crédit d\'impôt pour investissement productif en outre-mer',
      base_legale: 'Article 244 quater W du CGI',
      taux: {
        taux_base_pct:       '38,25%',
        taux_majore_pme_pct: '45%',
      },
      retrocession: {
        taux_minimum_retrocession_pct: '52,63%',
        taux_usuel_marche:             '60% à 75%',
      },
      procedure_declaration: {
        formulaire: '2069-RCI',
        depot:      'Annexé à la déclaration IS (2065)',
      },
      note: 'Données complètes disponibles via l\'API — données statiques de secours actives.',
    }
  };
}
