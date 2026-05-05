import React, { useMemo } from "react";
import styles from "./PedidoCard.module.css";

/**
 * props:
 * - pedido: { id, createdAt, status, serviceType, origin, destination, km, price }
 * - isCurrent?: boolean
 * - onVer(id)
 * - onCancelar(id)
 * - onRepetir(pedido)
 * - onEliminar(id)
 */
export default function PedidoCard({
  pedido,
  isCurrent,
  onVer,
  onCancelar,
  onRepetir,
  onEliminar,
}) {
  const fecha = useMemo(() => {
    try {
      if (!pedido?.createdAt) return "—";

      const d = new Date(pedido.createdAt);

      if (Number.isNaN(d.getTime())) return "—";

      return d.toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return "—";
    }
  }, [pedido?.createdAt]);

  const price = Number(pedido?.price || pedido?.breakdown?.total || 0);
  const km = Number(pedido?.km || pedido?.breakdown?.km || 0);

  const estado = String(pedido?.status || "pendiente").toLowerCase();
  const estadoInfo = getEstadoInfo(estado);

  const serviceType = formatServiceType(pedido?.serviceType || pedido?.service || "");
  const shortId = getShortId(pedido?.id);

  const canCancel = ["pendiente", "buscando", "ofertando", "ofertado"].includes(
    estado
  );

  const canRepeat = [
    "cancelado",
    "rechazado",
    "entregado",
    "completado",
    "finalizado",
    "asignado",
    "en_camino",
    "en_curso",
  ].includes(estado);

  const canDelete = ["cancelado", "rechazado"].includes(estado);

  return (
    <article
      className={`${styles.card} ${isCurrent ? styles.cardCurrent : ""}`}
      aria-label={`Pedido ${pedido?.id || ""}`}
    >
      <header className={styles.head}>
        <div className={styles.statusGroup}>
          <span className={`${styles.badge} ${styles[estadoInfo.className]}`}>
            <span className={styles.badgeDot} />
            {estadoInfo.label}
          </span>

          {isCurrent && <span className={styles.currentBadge}>Actual</span>}
        </div>

        <div className={styles.orderMeta}>
          <strong>{shortId}</strong>
          <span>{fecha}</span>
        </div>
      </header>

      <div className={styles.routeBox}>
        <div className={styles.routeItem}>
          <span className={`${styles.routeDot} ${styles.originDot}`} />
          <div>
            <small>Origen</small>
            <p>{pedido?.origin || pedido?.originInput || "—"}</p>
          </div>
        </div>

        <div className={styles.routeLine} />

        <div className={styles.routeItem}>
          <span className={`${styles.routeDot} ${styles.destinationDot}`} />
          <div>
            <small>Destino</small>
            <p>{pedido?.destination || pedido?.destinationInput || "—"}</p>
          </div>
        </div>
      </div>

      <div className={styles.infoRow}>
        <div className={styles.infoPill}>
          {distanceIcon}
          <span>{km ? `${km.toFixed(2)} km` : "Distancia —"}</span>
        </div>

        <div className={styles.infoPill}>
          {serviceIcon}
          <span>{serviceType || "Servicio —"}</span>
        </div>
      </div>

      <footer className={styles.foot}>
        <div className={styles.total}>
          <span>Total</span>
          <strong>
            {price ? `$${price.toLocaleString("es-AR")}` : "—"}
          </strong>
        </div>

        <div className={styles.actions}>
          {canCancel && (
            <button
              className={styles.btnGhost}
              type="button"
              onClick={() => onCancelar?.(pedido.id)}
              aria-label="Cancelar pedido"
            >
              Cancelar
            </button>
          )}

          {canRepeat && (
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

          {canDelete && (
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
    case "ofertando":
    case "ofertado":
      return { label: "Pendiente", className: "pending" };

    case "asignado":
      return { label: "Asignado", className: "assigned" };

    case "en_camino":
    case "en_curso":
    case "en curso":
    case "encurso":
      return { label: "En curso", className: "active" };

    case "entregado":
    case "completado":
    case "finalizado":
      return { label: "Finalizado", className: "done" };

    case "cancelado":
    case "rechazado":
      return { label: "Cancelado", className: "cancel" };

    default:
      return { label: status || "Pendiente", className: "pending" };
  }
}

function formatServiceType(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  const map = {
    simple: "Simple",
    box: "Box",
    bigbox: "BigBox",
    valores: "Valores",
    delivery: "Delivery",
  };

  return map[text.toLowerCase()] || text;
}

function getShortId(id) {
  const text = String(id || "").trim();

  if (!text) return "#—";

  if (text.length <= 12) return `#${text}`;

  return `#${text.slice(-8)}`;
}

const distanceIcon = (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 19c-2 0-3-1.2-3-2.7C3 14.7 4.2 14 6 14h12c1.8 0 3-.7 3-2.3C21 10.2 20 9 18 9H6" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="9" r="2" />
  </svg>
);

const serviceIcon = (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96L12 12l8.73-5.04" />
  </svg>
);