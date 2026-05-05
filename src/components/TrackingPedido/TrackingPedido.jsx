import styles from "./TrackingPedido.module.css";

function getCadeteNombre(cadete) {
  if (!cadete) return "Repartidor asignado";

  return (
    [cadete.nombre, cadete.apellido].filter(Boolean).join(" ") ||
    cadete.alias ||
    cadete.id ||
    cadete.cadeteId ||
    "Repartidor asignado"
  );
}

function getCadeteBadge(cadete) {
  const tipo = String(
    cadete?.tipoListado ||
      cadete?.tipoRepartidor ||
      cadete?.modoIngresoOperativo ||
      ""
  ).toLowerCase();

  if (tipo.includes("online")) return "Online";
  if (tipo.includes("local")) return "Local";
  if (tipo.includes("hibrido")) return "Híbrido";

  return "Asignado";
}

function getPedidoTrackingState(pedido) {
  if (!pedido) {
    return {
      key: "loading",
      title: "Preparando seguimiento",
      text: "Estamos obteniendo la información de tu pedido.",
      label: "Seguimiento",
      progress: 10,
      activeIndex: 0,
    };
  }

  if (pedido.status === "finalizado" || pedido.currentStep === "delivered") {
    return {
      key: "delivered",
      title: "Pedido entregado",
      text: "Tu pedido fue entregado correctamente.",
      label: "Finalizado",
      progress: 100,
      activeIndex: 5,
    };
  }

  const step = pedido.currentStep || pedido.statusOperativo || "";

  if (step === "go_to_pickup") {
    return {
      key: "assigned",
      title: "Repartidor asignado",
      text: "Tu repartidor ya fue asignado y está por iniciar el retiro.",
      label: "Asignado",
      progress: 20,
      activeIndex: 1,
    };
  }

  if (step === "started_pickup") {
    return {
      key: "started_pickup",
      title: "Va al punto de retiro",
      text: "El repartidor está yendo a buscar tu pedido.",
      label: "En camino al origen",
      progress: 38,
      activeIndex: 2,
    };
  }

  if (step === "arrived_pickup") {
    return {
      key: "arrived_pickup",
      title: "Llegó al punto de retiro",
      text: "El repartidor llegó al origen y está retirando el pedido.",
      label: "En origen",
      progress: 54,
      activeIndex: 3,
    };
  }

  if (step === "go_to_dropoff" || pedido.statusOperativo === "picked_up") {
    return {
      key: "go_to_dropoff",
      title: "Pedido retirado",
      text: "Tu pedido ya fue retirado y va camino al destino.",
      label: "En camino al destino",
      progress: 72,
      activeIndex: 4,
    };
  }

  if (step === "arrived_dropoff") {
    return {
      key: "arrived_dropoff",
      title: "Llegó al destino",
      text: "El repartidor llegó al domicilio de entrega.",
      label: "En destino",
      progress: 88,
      activeIndex: 5,
    };
  }

  if (
    pedido.status === "asignado" ||
    pedido.assignmentStatus === "assigned" ||
    pedido.serverStatus === "matched"
  ) {
    return {
      key: "assigned",
      title: "Repartidor asignado",
      text: "Ya tenemos un repartidor asignado para tu pedido.",
      label: "Asignado",
      progress: 20,
      activeIndex: 1,
    };
  }

  return {
    key: "active",
    title: "Seguimiento activo",
    text: "Estamos actualizando el estado de tu pedido.",
    label: "En seguimiento",
    progress: 15,
    activeIndex: 0,
  };
}

function getAddress(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function formatMoney(value) {
  const num = Number(value || 0);

  if (!Number.isFinite(num) || num <= 0) return "—";

  return `$${num.toLocaleString("es-AR")}`;
}

function getPhone(pedido) {
  return (
    pedido?.recipient?.phone ||
    pedido?.contactTo ||
    pedido?.customerSnapshot?.telefono ||
    pedido?.customerPhone ||
    ""
  );
}

const STEPS = [
  "Pedido",
  "Asignado",
  "Retiro",
  "Origen",
  "En viaje",
  "Entrega",
];

export default function TrackingPedido({ pedido }) {
  const cadete = pedido?.assignedCadete || null;
  const nombreCadete = getCadeteNombre(cadete);
  const tracking = getPedidoTrackingState(pedido);

  const tieneUbicacion =
    typeof cadete?.lat === "number" && typeof cadete?.lng === "number";

  const origin = getAddress(
    pedido?.originInput || pedido?.origin || pedido?.pickup?.address,
    "Origen no informado"
  );

  const destination = getAddress(
    pedido?.destinationInput || pedido?.destination || pedido?.dropoff?.address,
    "Destino no informado"
  );

  const telefono = getPhone(pedido);
  const precio = formatMoney(pedido?.price || pedido?.breakdown?.total);
  const movilidad = cadete?.movilidad || "Movilidad no informada";
  const sucursal = cadete?.sucursal ? ` · ${cadete.sucursal}` : "";
  const badge = getCadeteBadge(cadete);

  return (
    <div className={`${styles.screen} ${styles[`screen_${tracking.key}`] || ""}`}>
      <section className={styles.mapArea}>
        <div className={styles.mapPlaceholder}>
          <div className={styles.mapGrid} />

          <div className={styles.routeLine} />

          <div className={styles.originMarker}>
            <span>Origen</span>
          </div>

          <div className={styles.destinationMarker}>
            <span>Destino</span>
          </div>

          <div className={`${styles.cadeteMarker} ${styles[`cadete_${tracking.key}`] || ""}`}>
            <span className={styles.cadetePulse} />
            <strong>{cadete?.movilidad || "Cadete"}</strong>
          </div>

          <div className={styles.mapNotice}>
            {tieneUbicacion
              ? "Ubicación inicial del repartidor"
              : "Vista previa del recorrido"}
          </div>
        </div>
      </section>

      <section className={styles.bottomSheet}>
        <div className={styles.handle} />

        <div className={styles.statusBlock}>
          <span className={styles.statusLabel}>{tracking.label}</span>
          <h1 className={styles.statusTitle}>{tracking.title}</h1>
          <p className={styles.statusText}>{tracking.text}</p>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressHeader}>
            <span>Progreso del envío</span>
            <strong>{tracking.progress}%</strong>
          </div>

          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${tracking.progress}%` }}
            />
          </div>

          <div className={styles.steps}>
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`${styles.stepDot} ${
                  index <= tracking.activeIndex ? styles.stepDotActive : ""
                }`}
              >
                <span />
                <small>{step}</small>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.cadeteCard}>
          <div className={styles.avatar}>
            {nombreCadete.charAt(0).toUpperCase()}
          </div>

          <div className={styles.cadeteInfo}>
            <h2>{nombreCadete}</h2>
            <p>
              {movilidad}
              {sucursal}
            </p>
          </div>

          <div className={styles.badge}>{badge}</div>
        </div>

        <div className={styles.quickInfo}>
          <div>
            <span>Total</span>
            <strong>{precio}</strong>
          </div>

          <div>
            <span>Pago</span>
            <strong>
              {pedido?.paymentMethod === "digital" ? "Digital" : "Efectivo"}
            </strong>
          </div>
        </div>

        <div className={styles.orderInfo}>
          <div>
            <span>Origen</span>
            <strong>{origin}</strong>
          </div>

          <div>
            <span>Destino</span>
            <strong>{destination}</strong>
          </div>
        </div>

        <div className={styles.actions}>
          {telefono ? (
            <a className={styles.secondaryBtn} href={`tel:${telefono}`}>
              Llamar
            </a>
          ) : (
            <button className={styles.secondaryBtn} type="button" disabled>
              Sin teléfono
            </button>
          )}

          <button type="button" className={styles.primaryBtn}>
            Ver detalle
          </button>
        </div>
      </section>
    </div>
  );
}