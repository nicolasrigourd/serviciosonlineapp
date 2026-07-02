import { clienteDb } from "../db/clienteDb";

// ─── Status sets ──────────────────────────────────────────────────────────────
const ACTIVE_STATUSES = new Set([
  "pending", "pendiente",
  "assigned", "asignado",
  "offering", "ofertando", "ofertado",
  "en_camino", "en_camino_origen", "en_camino_destino",
  "en curso", "encurso", "en_curso",
  "enviado_local", "asignado_online",
  "retirado",
]);

const FINAL_STATUSES = new Set([
  "completed", "delivered", "entregado", "finalizado", "completado",
  "cancelled", "canceled", "cancelado", "rechazado",
]);

function nowISO() { return new Date().toISOString(); }
const norm = (s) => String(s || "").toLowerCase().trim();

// ─── Dexie helpers (async) ────────────────────────────────────────────────────

/** Guarda o actualiza un pedido en IndexedDB */
export async function saveOrderDb(order) {
  if (!order) return;
  const orderId = order.orderId || order.id;
  if (!orderId) return;
  await clienteDb.orders.put({ ...order, orderId });
}

/** Carga todos los pedidos activos (no finalizados ni cancelados) */
export async function loadActiveOrdersDb() {
  const all = await clienteDb.orders.toArray();
  return all.filter((p) => ACTIVE_STATUSES.has(norm(p.status)));
}

/** Carga un pedido por orderId */
export async function loadOrderByIdDb(orderId) {
  if (!orderId) return null;
  return (await clienteDb.orders.get(orderId)) ?? null;
}

/** Carga todos los pedidos (para historial) */
export async function loadAllOrdersDb() {
  const all = await clienteDb.orders.toArray();
  return all.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

/** Aplica un patch parcial a un pedido existente */
export async function patchOrderDb(orderId, patch) {
  if (!orderId) return;
  await clienteDb.orders.update(orderId, {
    ...patch,
    updatedAt: nowISO(),
    updatedAtMs: Date.now(),
  });
}

/** Cancela un pedido en IndexedDB */
export async function cancelOrderDb(orderId) {
  if (!orderId) return;
  await clienteDb.orders.update(orderId, {
    status: "cancelled",
    updatedAt: nowISO(),
    updatedAtMs: Date.now(),
    "cancellation.cancelledAt": nowISO(),
    "cancellation.cancelledAtMs": Date.now(),
  });
}

// ─── Legacy localStorage — mantenidas por compatibilidad con código viejo ─────
// TODO: eliminar cuando todos los callers estén migrados a Dexie

const HIST_KEY    = "PedidosApp";
const CURRENT_KEY = "NuevoPedido";

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

export function loadHistorial() {
  const arr = safeParse(localStorage.getItem(HIST_KEY), []);
  return Array.isArray(arr) ? arr : [];
}

export function saveHistorial(arr) {
  localStorage.setItem(HIST_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
}

export function appendToHistorial(pedido) {
  const arr = loadHistorial();
  arr.unshift(pedido);
  saveHistorial(arr);
  return arr;
}

export function upsertInHistorial(pedidoParcial) {
  const arr = loadHistorial();
  const idx = arr.findIndex((x) => x?.id === pedidoParcial?.id);
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...pedidoParcial };
  } else {
    arr.unshift(pedidoParcial);
  }
  saveHistorial(arr);
  return arr;
}

export function removeFromHistorial(id) {
  const arr = loadHistorial().filter((p) => p?.id !== id);
  saveHistorial(arr);
  return arr;
}

export function loadActual() {
  const obj = safeParse(localStorage.getItem(CURRENT_KEY), null);
  return obj && typeof obj === "object" && obj.id ? obj : null;
}

export function saveActual(pedido) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(pedido || null));
}

export function clearActual() {
  localStorage.removeItem(CURRENT_KEY);
}

export function setActualStatus(newStatus) {
  const current = loadActual();
  if (!current) return null;
  const updated = { ...current, status: String(newStatus || "").trim() || current.status, updatedAt: nowISO() };
  saveActual(updated);
  upsertInHistorial(updated);
  return updated;
}

export function cancelActualAndArchive() {
  const current = loadActual();
  if (!current) return null;
  const canceled = { ...current, status: "cancelado", canceledAt: nowISO(), updatedAt: nowISO() };
  upsertInHistorial(canceled);
  clearActual();
  return canceled;
}

export function archiveActualWithStatus(finalStatus) {
  const current = loadActual();
  if (!current) return null;
  const finished = { ...current, status: String(finalStatus || "").trim() || current.status, finishedAt: nowISO(), updatedAt: nowISO() };
  upsertInHistorial(finished);
  clearActual();
  return finished;
}
