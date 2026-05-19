/**
 * Handler — Marchés Publics Guadeloupe (971)
 * GET /api/v1/marches-publics/guadeloupe
 *
 * Données en temps réel depuis data.economie.gouv.fr (DECP augmenté)
 * 4 400+ marchés publics Guadeloupe — mis à jour quotidiennement
 */

const DECP_API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp_augmente/records';

export async function handleMarchesPublics(request, env) {
  const url    = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '20'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const nature = url.searchParams.get('nature');   // Travaux | Fournitures | Services
  const annee  = url.searchParams.get('annee');    // ex: 2024

  // Construction du filtre ODSQL
  let where = 'codedepartementexecution="971"';
  if (nature) where += ` AND natureobjetmarche="${nature}"`;
  if (annee)  where += ` AND anneenotification="${annee}"`;

  const params = new URLSearchParams({
    where,
    limit:  limit.toString(),
    offset: offset.toString(),
    select: 'id,objetmarche,montant,datenotification,anneenotification,nomacheteur,lieuexecutionnom,referencecpv,natureobjetmarche,procedure,denominationsocialeetablissement',
    order_by: 'datenotification DESC',
  });

  try {
    const response = await fetch(`${DECP_API}?${params}`);
    if (!response.ok) throw new Error(`DECP API error: ${response.status}`);

    const json = await response.json();

    // Statistiques rapides
    const montants = json.results
      .map(r => r.montant)
      .filter(Boolean);

    const stats = montants.length > 0 ? {
      montant_moyen_eur:  Math.round(montants.reduce((a, b) => a + b, 0) / montants.length),
      montant_total_eur:  Math.round(montants.reduce((a, b) => a + b, 0)),
      montant_max_eur:    Math.round(Math.max(...montants)),
    } : null;

    return {
      data: {
        total_marches_guadeloupe: json.total_count,
        marches:  json.results,
        stats_echantillon: stats,
      },
      meta: {
        source:           'data.economie.gouv.fr — DECP augmenté',
        dataset:          'decp_augmente',
        departement:      '971 — Guadeloupe',
        filtre_nature:    nature || 'tous',
        filtre_annee:     annee  || 'toutes',
        limit,
        offset,
        update_frequency: 'Quotidienne',
        last_fetch:       new Date().toISOString(),
        licence:          'Licence Ouverte Etalab 2.0',
      },
      disclaimer: 'Données DECP (Données Essentielles de la Commande Publique) — source officielle data.economie.gouv.fr. Utilisation libre sous Licence Ouverte Etalab.',
    };
  } catch (error) {
    console.error('[marches-publics] Erreur API DECP:', error.message);
    return {
      data:       null,
      meta:       { error: 'Données temporairement indisponibles', source: 'data.economie.gouv.fr' },
      disclaimer: 'Données DECP officielle Guadeloupe.',
    };
  }
}
