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
