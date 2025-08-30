// Claves en LocalStorage
const HIST_KEY = "PedidosApp";     // historial (array)
const CURRENT_KEY = "NuevoPedido"; // pedido actual (objeto)

// ---------- Utils ----------
function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}
function nowISO() { return new Date().toISOString(); }

// ---------- Historial ----------
export function loadHistorial() {
  const raw = localStorage.getItem(HIST_KEY);
  const arr = safeParse(raw, []);
  return Array.isArray(arr) ? arr : [];
}

export function saveHistorial(arr) {
  localStorage.setItem(HIST_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
}

/** Inserta al inicio (más reciente primero) */
export function appendToHistorial(pedido) {
  const arr = loadHistorial();
  arr.unshift(pedido);
  saveHistorial(arr);
  return arr;
}

/** Upsert por id en historial */
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

/** Eliminar por id del historial */
export function removeFromHistorial(id) {
  const arr = loadHistorial().filter((p) => p?.id !== id);
  saveHistorial(arr);
  return arr;
}

// ---------- Pedido actual ----------
export function loadActual() {
  const raw = localStorage.getItem(CURRENT_KEY);
  if (!raw) return null;
  const obj = safeParse(raw, null);
  return obj && typeof obj === "object" && obj.id ? obj : null;
}

export function saveActual(pedido) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(pedido || null));
}

export function clearActual() {
  localStorage.removeItem(CURRENT_KEY);
}

/**
 * Actualiza el status del pedido actual (si existe), sincronizando también el historial (upsert).
 * Devuelve el objeto actualizado o null si no había pedido actual.
 */
export function setActualStatus(newStatus) {
  const current = loadActual();
  if (!current) return null;

  const updated = {
    ...current,
    status: String(newStatus || "").trim() || current.status,
    updatedAt: nowISO(),
  };

  saveActual(updated);
  upsertInHistorial(updated);
  return updated;
}

/**
 * Cancela el pedido actual:
 * - marca status = "cancelado"
 * - registra canceledAt
 * - upsertea en historial (PedidosApp)
 * - borra NuevoPedido
 * Devuelve el objeto cancelado (o null si no había actual).
 */
export function cancelActualAndArchive() {
  const current = loadActual();
  if (!current) return null;

  const canceled = {
    ...current,
    status: "cancelado",
    canceledAt: nowISO(),
    updatedAt: nowISO(),
  };

  upsertInHistorial(canceled);
  clearActual();
  return canceled;
}

/**
 * Archiva el pedido actual con un estado final dado (ej: "entregado", "rechazado"),
 * y limpia NuevoPedido.
 */
export function archiveActualWithStatus(finalStatus) {
  const current = loadActual();
  if (!current) return null;

  const finished = {
    ...current,
    status: String(finalStatus || "").trim() || current.status,
    finishedAt: nowISO(),
    updatedAt: nowISO(),
  };

  upsertInHistorial(finished);
  clearActual();
  return finished;
}
