import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../services/firebase";
import styles from "./TrackingPedido.module.css";

const STEPS = [
  "Pedido",
  "Asignado",
  "Retiro",
  "Origen",
  "En viaje",
  "Entrega",
];

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function getPedidoId(pedido) {
  return normalizeText(pedido?.orderId || pedido?._docId || pedido?.id);
}

function getAssignedDriver(pedido) {
  return pedido?.assignment?.assignedDriver || null;
}

function getAssignedDriverId(pedido) {
  return normalizeText(
    pedido?.assignedDriverId || pedido?.assignment?.assignedDriverId
  );
}

function getDriverName(driver) {
  if (!driver) return "Repartidor asignado";

  return (
    normalizeText(driver.fullName) ||
    [driver.firstName, driver.lastName]
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join(" ") ||
    normalizeText(driver.driverId) ||
    "Repartidor asignado"
  );
}

function getDriverMobility(driver) {
  return normalizeText(driver?.mobility, "Movilidad no informada");
}

function getDriverBranch(driver) {
  const branch = normalizeText(driver?.branch);
  return branch ? ` · ${branch}` : "";
}

function getDriverBadge(driver) {
  if (driver?.usesApp === true) return "Online";

  const listType = normalizeText(driver?.listType).toLowerCase();

  if (listType === "online") return "Online";
  if (listType === "local") return "Local";
  if (listType === "hybrid") return "Híbrido";

  return "Asignado";
}

function getDeliveryStep(pedido) {
  return normalizeStatus(pedido?.delivery?.currentStep || "go_to_pickup");
}

function getDeliveryStatus(pedido) {
  return normalizeStatus(pedido?.delivery?.operationalStatus || "");
}

function isDelivered(pedido) {
  const status = normalizeStatus(pedido?.status);
  const step = getDeliveryStep(pedido);
  const operationalStatus = getDeliveryStatus(pedido);

  return (
    status === "completed" ||
    step === "delivered" ||
    operationalStatus === "delivered"
  );
}

function isCancelled(pedido) {
  return normalizeStatus(pedido?.status) === "cancelled";
}

function getRatingType(score) {
  const value = Number(score || 0);
  return value <= 2 ? "negative" : "positive";
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

  if (isCancelled(pedido)) {
    return {
      key: "cancelled",
      title: "Pedido cancelado",
      text: "Este pedido fue cancelado.",
      label: "Cancelado",
      progress: 0,
      activeIndex: 0,
    };
  }

  if (isDelivered(pedido)) {
    return {
      key: "delivered",
      title: "Pedido entregado",
      text: "Tu pedido fue entregado correctamente.",
      label: "Finalizado",
      progress: 100,
      activeIndex: 5,
    };
  }

  const status = normalizeStatus(pedido?.status);
  const assignmentStatus = normalizeStatus(pedido?.assignment?.status);
  const serverStatus = normalizeStatus(pedido?.server?.status);
  const step = getDeliveryStep(pedido);
  const operationalStatus = getDeliveryStatus(pedido);

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

  if (step === "started_pickup" || operationalStatus === "started_pickup") {
    return {
      key: "started_pickup",
      title: "Va al punto de retiro",
      text: "El repartidor está yendo a buscar tu pedido.",
      label: "En camino al origen",
      progress: 38,
      activeIndex: 2,
    };
  }

  if (step === "arrived_pickup" || operationalStatus === "arrived_pickup") {
    return {
      key: "arrived_pickup",
      title: "Llegó al punto de retiro",
      text: "El repartidor llegó al origen y está retirando el pedido.",
      label: "En origen",
      progress: 54,
      activeIndex: 3,
    };
  }

  if (step === "go_to_dropoff" || operationalStatus === "picked_up") {
    return {
      key: "go_to_dropoff",
      title: "Pedido retirado",
      text: "Tu pedido ya fue retirado y va camino al destino.",
      label: "En camino al destino",
      progress: 72,
      activeIndex: 4,
    };
  }

  if (step === "arrived_dropoff" || operationalStatus === "arrived_dropoff") {
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
    status === "assigned" ||
    assignmentStatus === "assigned" ||
    serverStatus === "matched"
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

function formatMoney(value) {
  const num = Number(value || 0);

  if (!Number.isFinite(num) || num <= 0) return "—";

  return `$${num.toLocaleString("es-AR")}`;
}

function getPickupAddress(pedido) {
  return normalizeText(pedido?.pickup?.address, "Origen no informado");
}

function getDropoffAddress(pedido) {
  return normalizeText(pedido?.dropoff?.address, "Destino no informado");
}

function getPrice(pedido) {
  return pedido?.pricing?.price ?? pedido?.payment?.amount ?? null;
}

function getPaymentLabel(pedido) {
  const method = normalizeText(pedido?.payment?.method);
  const provider = normalizeText(pedido?.payment?.provider);

  if (method === "cash") return "Efectivo";
  if (method === "digital" && provider === "mercadopago") return "MercadoPago";
  if (method === "digital") return "Digital";

  return normalizeText(pedido?.payment?.label, "No informado");
}

export default function TrackingPedido({ pedido }) {
  const navigate = useNavigate();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState("");

  const driver = getAssignedDriver(pedido);
  const driverId = getAssignedDriverId(pedido);
  const driverName = getDriverName(driver);
  const tracking = getPedidoTrackingState(pedido);

  const delivered = isDelivered(pedido);

  const origin = getPickupAddress(pedido);
  const destination = getDropoffAddress(pedido);

  const precio = formatMoney(getPrice(pedido));
  const movilidad = getDriverMobility(driver);
  const sucursal = getDriverBranch(driver);
  const badge = getDriverBadge(driver);
  const paymentLabel = getPaymentLabel(pedido);

  const selectedRating = hoverRating || rating;

  const ratingText = useMemo(() => {
    const value = rating || hoverRating;

    if (value === 1) return "Muy mala";
    if (value === 2) return "Mala";
    if (value === 3) return "Correcta";
    if (value === 4) return "Muy buena";
    if (value === 5) return "Excelente";

    return "Seleccioná una puntuación";
  }, [rating, hoverRating]);

  const handleSubmitRating = async () => {
    if (!rating) {
      setRatingError("Seleccioná una puntuación para finalizar.");
      return;
    }

    const pedidoId = getPedidoId(pedido);

    if (!pedidoId) {
      setRatingError("No pudimos identificar el pedido para guardar la valoración.");
      return;
    }

    const ratingType = getRatingType(rating);

    setSavingRating(true);
    setRatingError("");

    try {
      await updateDoc(doc(db, "orders", pedidoId), {
        "rating.value": rating,
        "rating.score": rating,
        "rating.type": ratingType,
        "rating.driverId": driverId || null,
        "rating.driverName": driverName,
        "rating.ratedAt": serverTimestamp(),
        "rating.source": "customer_app",

        customerRated: true,
        customerRatedAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      });

      localStorage.removeItem("NuevoPedido");

      navigate("/home", { replace: true });
    } catch (error) {
      console.error("[TRACKING][RATING] Error guardando valoración:", error);
      setRatingError("No pudimos guardar la valoración. Intentá nuevamente.");
    } finally {
      setSavingRating(false);
    }
  };

  if (delivered) {
    return (
      <div className={styles.ratingScreen}>
        <section className={styles.ratingCard}>
          <div className={styles.ratingIcon}>✓</div>

          <span className={styles.ratingLabel}>Pedido entregado</span>

          <h1>¿Cómo fue tu experiencia?</h1>

          <p>
            Tu pedido fue finalizado correctamente. Para volver al inicio,
            primero calificá la entrega.
          </p>

          <div className={styles.ratingCadeteCard}>
            <div className={styles.avatar}>
              {driverName.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{driverName}</strong>
              <span>
                {movilidad}
                {sucursal}
              </span>
            </div>
          </div>

          <div className={styles.stars} aria-label="Calificación del repartidor">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= selectedRating;

              return (
                <button
                  key={star}
                  type="button"
                  className={`${styles.starBtn} ${
                    active ? styles.starBtnActive : ""
                  }`}
                  onClick={() => {
                    setRating(star);
                    setRatingError("");
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`Calificar con ${star} estrella${star > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              );
            })}
          </div>

          <div className={styles.ratingText}>{ratingText}</div>

          {ratingError && (
            <div className={styles.ratingError}>{ratingError}</div>
          )}

          <button
            type="button"
            className={styles.ratingSubmitBtn}
            onClick={handleSubmitRating}
            disabled={!rating || savingRating}
          >
            {savingRating ? "Guardando..." : "Enviar calificación y volver al inicio"}
          </button>

          {!rating && (
            <small className={styles.ratingHint}>
              La calificación es obligatoria para cerrar el seguimiento.
            </small>
          )}
        </section>
      </div>
    );
  }

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

          <div
            className={`${styles.cadeteMarker} ${
              styles[`cadete_${tracking.key}`] || ""
            }`}
          >
            <span className={styles.cadetePulse} />
            <strong>{movilidad || "Repartidor"}</strong>
          </div>

          <div className={styles.mapNotice}>
            Seguimiento operativo del pedido
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
            {driverName.charAt(0).toUpperCase()}
          </div>

          <div className={styles.cadeteInfo}>
            <h2>{driverName}</h2>
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
            <strong>{paymentLabel}</strong>
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
          <button type="button" className={styles.primaryBtn}>
            Ver detalle
          </button>
        </div>
      </section>
    </div>
  );
}