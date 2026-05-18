/**
 * Admin Providers — CRUD fournisseurs protégé
 *
 * Toutes les routes commencent par /admin/providers/
 * Authentification : header X-Admin-Key = secret wrangler ADMIN_API_KEY
 *
 * Routes :
 *   GET    /admin/providers               → liste tous les fournisseurs (tous statuts)
 *   POST   /admin/providers               → créer un fournisseur
 *   GET    /admin/providers/{slug}        → détail fournisseur
 *   PATCH  /admin/providers/{slug}        → mettre à jour (statut, nom…)
 *   DELETE /admin/providers/{slug}        → supprimer
 *   POST   /admin/providers/{slug}/endpoints/{ep} → ajouter un endpoint
 *   GET    /admin/providers/{slug}/ledger → état du compte
 *   GET    /admin/ledger                  → vue globale tous fournisseurs
 */

import {
  createProvider, updateProvider, deleteProvider,
  getProvider, listProviders, addEndpoint,
} from '../marketplace/registry.js';
import { getLedger, getOperations } from '../marketplace/commission.js';

// ─── Dispatcher ───────────────────────────────────────────────────────

export async function handleAdmin(request, env, pathname) {
  if (!isAdminAuthenticated(request, env)) {
    return jsonResponse({ success: false, error: 'UNAUTHORIZED' }, 401);
  }

  const method   = request.method;
  const segments = pathname.replace(/^\/admin\/providers\/?/, '').split('/').filter(Boolean);

  // GET /admin/providers — liste globale
  if (segments.length === 0 && method === 'GET') {
    return handleListAll(env);
  }

  // POST /admin/providers — créer
  if (segments.length === 0 && method === 'POST') {
    return handleCreate(request, env);
  }

  // /admin/ledger — vue globale du ledger
  if (pathname === '/admin/ledger') {
    return handleGlobalLedger(env);
  }

  const [providerSlug, section, endpointSlug] = segments;

  // GET  /admin/providers/{slug}
  if (!section && method === 'GET') {
    return handleGet(env, providerSlug);
  }

  // PATCH /admin/providers/{slug}
  if (!section && method === 'PATCH') {
    return handleUpdate(request, env, providerSlug);
  }

  // DELETE /admin/providers/{slug}
  if (!section && method === 'DELETE') {
    return handleDelete(env, providerSlug);
  }

  // POST /admin/providers/{slug}/endpoints/{ep}
  if (section === 'endpoints' && endpointSlug && method === 'POST') {
    return handleAddEndpoint(request, env, providerSlug, endpointSlug);
  }

  // GET /admin/providers/{slug}/ledger
  if (section === 'ledger' && method === 'GET') {
    return handleProviderLedger(env, providerSlug);
  }

  return jsonResponse({ success: false, error: 'ROUTE_NOT_FOUND' }, 404);
}

// ─── Handlers ─────────────────────────────────────────────────────────

async function handleListAll(env) {
  const providers = await listProviders(env, { status: 'all' });
  return jsonResponse({ success: true, count: providers.length, providers });
}

async function handleCreate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const provider = await createProvider(env, body);
    return jsonResponse({ success: true, provider }, 201);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 400);
  }
}

async function handleGet(env, slug) {
  const provider = await getProvider(env, slug);
  if (!provider) return jsonResponse({ success: false, error: 'PROVIDER_NOT_FOUND' }, 404);
  return jsonResponse({ success: true, provider });
}

async function handleUpdate(request, env, slug) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const provider = await updateProvider(env, slug, body);
    return jsonResponse({ success: true, provider });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 400);
  }
}

async function handleDelete(env, slug) {
  const provider = await getProvider(env, slug);
  if (!provider) return jsonResponse({ success: false, error: 'PROVIDER_NOT_FOUND' }, 404);

  await deleteProvider(env, slug);
  return jsonResponse({ success: true, deleted: slug });
}

async function handleAddEndpoint(request, env, providerSlug, endpointSlug) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'INVALID_JSON' }, 400);
  }

  try {
    const provider = await addEndpoint(env, providerSlug, endpointSlug, body);
    return jsonResponse({ success: true, provider });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 400);
  }
}

async function handleProviderLedger(env, slug) {
  const provider = await getProvider(env, slug);
  if (!provider) return jsonResponse({ success: false, error: 'PROVIDER_NOT_FOUND' }, 404);

  const ledger = await getLedger(env, slug);
  const ops    = await getOperations(env, slug);

  return jsonResponse({
    success:  true,
    provider: slug,
    ledger,
    operations: ops,
  });
}

async function handleGlobalLedger(env) {
  const providers = await listProviders(env, { status: 'all' });

  const ledgers = await Promise.all(
    providers.map(async p => ({
      provider:         p.slug,
      name:             p.name,
      status:           p.status,
      ...(await getLedger(env, p.slug)),
    }))
  );

  const totalPending = ledgers.reduce((sum, l) => sum + parseFloat(l.pending_usdc ?? 0), 0);
  const totalEarned  = ledgers.reduce((sum, l) => sum + parseFloat(l.total_earned_usdc ?? 0), 0);

  return jsonResponse({
    success: true,
    summary: {
      total_pending_usdc: totalPending.toFixed(6),
      total_earned_usdc:  totalEarned.toFixed(6),
    },
    providers: ledgers,
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────

function isAdminAuthenticated(request, env) {
  const key = request.headers.get('X-Admin-Key');
  return key && key === env.ADMIN_API_KEY;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
