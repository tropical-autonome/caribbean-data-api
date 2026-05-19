/**
 * Handler — Marchés Publics tous DOM
 * GET /api/v1/marches-publics/dom
 *
 * Données temps réel DECP — 31 000+ marchés
 * Guadeloupe (971) + Martinique (972) + Guyane (973) + La Réunion (974) + Mayotte (976)
 */

const DECP_API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp_augmente/records';

const DOM_DEPARTEMENTS = {
  '971': 'Guadeloupe',
  '972': 'Martinique',
  '973': 'Guyane',
  '974': 'La Réunion',
  '976': 'Mayotte',
};

export async function handleMarchesPublicsDom(request, env) {
  const url    = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '20'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const nature = url.searchParams.get('nature');     // Travaux | Fournitures | Services
  const annee  = url.searchParams.get('annee');      // ex: 2024
  const dep    = url.searchParams.get('departement'); // 971 | 972 | 973 | 974 | 976

  // Filtre ODSQL
  let where;
  if (dep && DOM_DEPARTEMENTS[dep]) {
    where = `codedepartementexecution="${dep}"`;
  } else {
    where = `codedepartementexecution IN ("971","972","973","974","976")`;
  }
  if (nature) where += ` AND natureobjetmarche="${nature}"`;
  if (annee)  where += ` AND anneenotification="${annee}"`;

  const params = new URLSearchParams({
    where,
    limit:    limit.toString(),
    offset:   offset.toString(),
    select:   'id,objetmarche,montant,datenotification,anneenotification,nomacheteur,lieuexecutionnom,codedepartementexecution,referencecpv,natureobjetmarche,procedure,denominationsocialeetablissement',
    order_by: 'datenotification DESC',
  });

  try {
    const response = await fetch(`${DECP_API}?${params}`);
    if (!response.ok) throw new Error(`DECP API error: ${response.status}`);

    const json = await response.json();

    // Répartition par département
    const parDep = {};
    for (const code of Object.keys(DOM_DEPARTEMENTS)) {
      parDep[code] = { nom: DOM_DEPARTEMENTS[code], count: 0, montant_total: 0 };
    }
    for (const m of json.results) {
      const d = m.codedepartementexecution;
      if (parDep[d]) {
        parDep[d].count++;
        parDep[d].montant_total += m.montant || 0;
      }
    }

    const montants = json.results.map(r => r.montant).filter(Boolean);
    const stats = montants.length > 0 ? {
      montant_moyen_eur: Math.round(montants.reduce((a, b) => a + b, 0) / montants.length),
      montant_total_eur: Math.round(montants.reduce((a, b) => a + b, 0)),
      montant_max_eur:   Math.round(Math.max(...montants)),
    } : null;

    return {
      data: {
        total_marches_dom: json.total_count,
        marches:           json.results,
        repartition_par_departement: parDep,
        stats_echantillon: stats,
      },
      meta: {
        source:           'data.economie.gouv.fr — DECP augmenté',
        territoires:      Object.values(DOM_DEPARTEMENTS).join(', '),
        filtre_dep:       dep ? `${dep} — ${DOM_DEPARTEMENTS[dep]}` : 'tous DOM',
        filtre_nature:    nature || 'tous',
        filtre_annee:     annee  || 'toutes',
        limit,
        offset,
        update_frequency: 'Quotidienne',
        last_fetch:       new Date().toISOString(),
        licence:          'Licence Ouverte Etalab 2.0',
      },
      disclaimer: 'Données DECP (Données Essentielles de la Commande Publique) officielles — data.economie.gouv.fr. Licence Ouverte Etalab 2.0.',
    };
  } catch (error) {
    console.error('[marches-publics-dom] Erreur API DECP:', error.message);
    return {
      data:    null,
      meta:    { error: 'Données temporairement indisponibles', source: 'data.economie.gouv.fr' },
      disclaimer: 'Données DECP officielle tous DOM.',
    };
  }
}
