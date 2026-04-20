import styles from "./TrackingPedido.module.css";

function getCadeteNombre(cadete) {
  if (!cadete) return "Repartidor asignado";

  return [cadete.nombre, cadete.apellido].filter(Boolean).join(" ") ||
    cadete.alias ||
    cadete.id ||
    cadete.cadeteId ||
    "Repartidor asignado";
}

function formatStatus(status) {
  const map = {
    enviado_local: "Repartidor asignado",
    asignado_online: "Repartidor asignado",
    en_camino_origen: "El repartidor va hacia el origen",
    retirado: "Pedido retirado",
    en_camino_destino: "El repartidor va hacia el destino",
    finalizado: "Pedido finalizado",
  };

  return map[status] || "Repartidor asignado";
}

export default function TrackingPedido({ pedido }) {
  const cadete = pedido?.assignedCadete || null;
  const nombreCadete = getCadeteNombre(cadete);

  const tieneUbicacion =
    typeof cadete?.lat === "number" && typeof cadete?.lng === "number";

  return (
    <div className={styles.screen}>
      <section className={styles.mapArea}>
        <div className={styles.mapPlaceholder}>
          <div className={styles.mapGrid} />

          <div className={styles.originMarker}>
            <span>Origen</span>
          </div>

          <div className={styles.destinationMarker}>
            <span>Destino</span>
          </div>

          <div className={styles.cadeteMarker}>
            <span className={styles.cadetePulse} />
            <strong>{cadete?.movilidad || "Cadete"}</strong>
          </div>

          {!tieneUbicacion && (
            <div className={styles.mapNotice}>
              Ubicación en preparación
            </div>
          )}
        </div>
      </section>

      <section className={styles.bottomSheet}>
        <div className={styles.handle} />

        <div className={styles.statusBlock}>
          <span className={styles.statusLabel}>Estado del envío</span>
          <h1 className={styles.statusTitle}>{formatStatus(pedido?.status)}</h1>
          <p className={styles.statusText}>
            Ya tenemos un repartidor asignado para tu pedido.
          </p>
        </div>

        <div className={styles.cadeteCard}>
          <div className={styles.avatar}>
            {nombreCadete.charAt(0).toUpperCase()}
          </div>

          <div className={styles.cadeteInfo}>
            <h2>{nombreCadete}</h2>
            <p>
              {cadete?.movilidad || "Movilidad no informada"}
              {cadete?.sucursal ? ` · ${cadete.sucursal}` : ""}
            </p>
          </div>

          <div className={styles.badge}>
            {cadete?.tipoListado === "online" ? "Online" : "Local"}
          </div>
        </div>

        <div className={styles.orderInfo}>
          <div>
            <span>Origen</span>
            <strong>
              {pedido?.originInput || pedido?.origin || "Origen no informado"}
            </strong>
          </div>

          <div>
            <span>Destino</span>
            <strong>
              {pedido?.destinationInput ||
                pedido?.destination ||
                "Destino no informado"}
            </strong>
          </div>
        </div>

        <div className={styles.actions}>
          {pedido?.customerSnapshot?.telefono && (
            <a
              className={styles.secondaryBtn}
              href={`tel:${pedido.customerSnapshot.telefono}`}
            >
              Llamar
            </a>
          )}

          <button type="button" className={styles.primaryBtn}>
            Ver detalle
          </button>
        </div>
      </section>
    </div>
  );
}