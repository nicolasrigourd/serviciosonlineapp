import Dexie from "dexie";

export const clienteDb = new Dexie("ClienteZeusDB");

// VERSION 1 — base inicial
// config:     clave genérica (sesión, flags de app)
// profile:    perfil del usuario logueado (siempre key "_key" = "me")
// orderTypes: tipos de servicio desde Firestore (reemplaza hardcoding en Home)
// pricing:    config/pricing desde Firestore (para calcular precios correctos)
// orders:     historial de pedidos del usuario (reemplaza localStorage PedidosApp)
clienteDb.version(1).stores({
  config:     "key",
  profile:    "_key",
  orderTypes: "id, active",
  pricing:    "key",
  orders:     "orderId, status, createdAtMs, dateKey, customerUid",
});

export default clienteDb;
