import React, { useMemo } from "react";
import styles from "./PedidoCard.module.css";

/**
 * props:
 * - pedido: { id, createdAt, status, serviceType, origin, destination, km, price }
 * - onVer(id)
 * - onCancelar(id)
 * - onRepetir(pedido)
 * - onEliminar(id)
 */
export default function PedidoCard({ pedido, onVer, onCancelar, onRepetir, onEliminar }) {
  const fecha = useMemo(() => {
    try {
      const d = new Date(pedido.createdAt);
      return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    } catch { return "—"; }
  }, [pedido.createdAt]);

  const price = Number(pedido.price || 0);
  const km = Number(pedido.km || 0);

  const estado = String(pedido.status || "pendiente");
  const estadoInfo = getEstadoInfo(estado);

  return (
    <article className={styles.card} aria-label={`Pedido ${pedido.id}`}>
      {/* Header */}
      <header className={styles.head}>
        <div className={styles.left}>
          <div className={`${styles.badge} ${styles[estadoInfo.className]}`}>
            {estadoInfo.label}
          </div>
          {pedido.serviceType && (
            <span className={styles.type}>{String(pedido.serviceType).toUpperCase()}</span>
          )}
        </div>
        <div className={styles.right}>
          <span className={styles.id}>#{pedido.id}</span>
          <span className={styles.date}>{fecha}</span>
        </div>
      </header>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.row}>
          <span className={styles.k}>Origen</span>
          <span className={styles.v}>{pedido.origin || "—"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.k}>Destino</span>
          <span className={styles.v}>{pedido.destination || "—"}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaI}>⟂ {km ? `${km} km` : "—"}</span>
          <span className={styles.metaI}>▣ {pedido.serviceType || "—"}</span>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.foot}>
        <div className={styles.total}>
          <span className={styles.totalK}>Total</span>
          <span className={styles.totalV}>{price ? `$${price.toLocaleString("es-AR")}` : "—"}</span>
        </div>

        <div className={styles.actions}>
          {["pendiente", "buscando"].includes(estado) && (
            <button
              className={styles.btnGhost}
              type="button"
              onClick={() => onCancelar?.(pedido.id)}
              aria-label="Cancelar pedido"
            >
              Cancelar
            </button>
          )}

          {["cancelado", "rechazado", "entregado", "completado", "asignado", "en_camino"].includes(estado) && (
            <button
              className={styles.btnGhost}
              type="button"
              onClick={() => onRepetir?.(pedido)}
              aria-label="Repetir pedido"
            >
              Repetir
            </button>
          )}

          <button
            className={styles.btnPrimary}
            type="button"
            onClick={() => onVer?.(pedido.id)}
            aria-label="Ver detalle"
          >
            Ver
          </button>

          {["cancelado", "rechazado"].includes(estado) && (
            <button
              className={styles.btnDanger}
              type="button"
              onClick={() => onEliminar?.(pedido.id)}
              aria-label="Eliminar del historial"
            >
              Eliminar
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

function getEstadoInfo(status) {
  switch (status) {
    case "pendiente":
    case "buscando":
      return { label: "En curso", className: "on" };
    case "asignado":
    case "en_camino":
      return { label: "Asignado", className: "assigned" };
    case "entregado":
    case "completado":
      return { label: "Finalizado", className: "done" };
    case "cancelado":
    case "rechazado":
      return { label: "Cancelado", className: "cancel" };
    default:
      return { label: status, className: "on" };
  }
}
