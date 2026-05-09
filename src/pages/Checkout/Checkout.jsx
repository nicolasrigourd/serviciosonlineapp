import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";

import { useFlow } from "../../state/FlowContext";
import styles from "./Checkout.module.css";
import { db } from "../../services/firebase";
import { cancelActualAndArchive } from "../../lib/pedidosStore";
import TrackingPedido from "../../components/TrackingPedido/TrackingPedido";

function norm(value) {
  return String(value || "").toLowerCase();
}

function getCheckoutWaitingState(pedido) {
  if (!pedido) {
    return {
      title: "Estamos preparando tu pedido",
      headline: "Registrando solicitud",
      description: "Estamos preparando los datos para iniciar la búsqueda.",
      reassure: "Esto puede demorar unos segundos.",
      messages: ["Preparando solicitud…"],
      badge: "PROCESANDO",
      tone: "processing",
      visual: "box",
      currentStep: "created",
    };
  }

  if (
    pedido?.assignmentStatus === "fallback_to_local" ||
    pedido?.serverStatus === "fallback_local"
  ) {
    return {
      title: "Lo gestiona la central",
      headline: "Tu pedido no queda sin atención",
      description:
        "No encontramos disponibilidad automática por ahora. La central local va a coordinarlo manualmente.",
      reassure:
        "Podés volver al inicio tranquilo. Te avisaremos cuando avance.",
      messages: [
        "Central coordinando disponibilidad…",
        "Buscando la mejor opción local…",
        "Tu pedido sigue activo…",
      ],
      badge: "CENTRAL",
      tone: "central",
      visual: "headset",
      currentStep: "central",
    };
  }

  if (pedido?.serverStatus === "retrying_match") {
    return {
      title: "Seguimos buscando",
      headline: "Estamos consultando otra disponibilidad",
      description:
        "El primer intento no se concretó, pero seguimos buscando un repartidor cercano.",
      reassure: "Tu pedido sigue en proceso y no tenés que cargarlo de nuevo.",
      messages: [
        "Buscando otro repartidor…",
        "Reintentando asignación…",
        "Verificando disponibilidad cercana…",
      ],
      badge: "REINTENTO",
      tone: "retry",
      visual: "radar",
      currentStep: "searching",
    };
  }

  if (
    pedido?.status === "ofertando" ||
    pedido?.serverStatus === "waiting_driver_response" ||
    pedido?.assignmentStatus === "offering"
  ) {
    return {
      title: "Un repartidor está revisando tu pedido",
      headline: "Esperando respuesta",
      description:
        "Le enviamos la solicitud a un repartidor cercano. Estamos esperando que confirme si puede tomarlo.",
      reassure:
        "Apenas responda, actualizamos el seguimiento automáticamente.",
      messages: [
        "Solicitud enviada al repartidor…",
        "Esperando respuesta…",
        "Validando disponibilidad…",
      ],
      badge: "OFERTANDO",
      tone: "offering",
      visual: "driver",
      currentStep: "searching",
    };
  }

  if (
    pedido?.serverStatus === "validated_online" ||
    pedido?.assignmentStatus === "unassigned" ||
    pedido?.status === "pendiente"
  ) {
    return {
      title: "Estamos buscando repartidor",
      headline: "Tu pedido ya fue recibido",
      description:
        "Estamos consultando disponibilidad cercana para asignarlo lo antes posible.",
      reassure:
        "No necesitás quedarte en esta pantalla. Podés seguirlo desde el inicio.",
      messages: [
        "Buscando repartidores disponibles…",
        "Optimizando la ruta…",
        "Verificando cobertura…",
        "Analizando disponibilidad cercana…",
      ],
      badge: "BUSCANDO",
      tone: "searching",
      visual: "radar",
      currentStep: "searching",
    };
  }

  return {
    title: "Tu pedido está en marcha",
    headline: "Estamos preparando el seguimiento",
    description:
      "Ya registramos tu pedido. Te avisaremos apenas tengamos novedades.",
    reassure: "Podés volver al inicio y seguirlo desde el panel inferior.",
    messages: [
      "Buscando disponibilidad…",
      "Preparando seguimiento…",
      "Verificando datos del pedido…",
    ],
    badge: "EN PROCESO",
    tone: "processing",
    visual: "box",
    currentStep: "created",
  };
}

function hasAssignedDriver(pedido) {
  return Boolean(
    pedido?.status === "asignado" ||
      pedido?.assignmentStatus === "assigned" ||
      pedido?.serverStatus === "matched" ||
      pedido?.assignedCadete?.id ||
      pedido?.assignedCadete?.cadeteId ||
      pedido?.assignedCadete?.nombre
  );
}

function formatTimestamp(value) {
  if (!value) return null;

  if (typeof value === "string") return value;

  if (value?.toDate) {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }

  return value;
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (!number) return "—";
  return `$${number.toLocaleString("es-AR")}`;
}

function formatDistance(value) {
  const number = Number(value || 0);
  if (!number) return "—";
  return `${number.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
  })} km`;
}

function shortOrderId(id) {
  const value = String(id || "");
  if (!value) return "—";
  if (value.length <= 8) return value;
  return `#${value.slice(-6)}`;
}

function getPickupAddress(pedido) {
  return (
    pedido?.pickup?.address ||
    pedido?.originInput ||
    pedido?.origin ||
    "Punto de retiro no informado"
  );
}

function getDropoffAddress(pedido) {
  return (
    pedido?.dropoff?.address ||
    pedido?.destinationInput ||
    pedido?.destination ||
    "Punto de entrega no informado"
  );
}

function getPickupContact(pedido) {
  return (
    pedido?.pickup?.contactName ||
    pedido?.sender?.name ||
    pedido?.contactFromName ||
    ""
  );
}

function getDropoffContact(pedido) {
  return (
    pedido?.dropoff?.contactName ||
    pedido?.recipient?.name ||
    pedido?.recipientName ||
    ""
  );
}

function formatPayment(pedido) {
  const method = pedido?.payment?.method || pedido?.paymentMethod;

  if (method === "cash") return "Efectivo";
  if (method === "mercadopago") return "MercadoPago";

  return pedido?.paymentLabel || "No informado";
}

function getProgressSteps(waitingState) {
  const current = waitingState.currentStep;

  const steps = [
    {
      key: "created",
      label: "Pedido",
      helper: "recibido",
    },
    {
      key: "searching",
      label: "Búsqueda",
      helper: "activa",
    },
    {
      key: "assigned",
      label: "Asignado",
      helper: "pendiente",
    },
    {
      key: "pickup",
      label: "Retiro",
      helper: "pendiente",
    },
    {
      key: "dropoff",
      label: "Entrega",
      helper: "pendiente",
    },
  ];

  const order = ["created", "searching", "assigned", "pickup", "dropoff"];
  const currentIndex =
    current === "central"
      ? 1
      : Math.max(0, order.indexOf(current));

  return steps.map((step, index) => ({
    ...step,
    done: index < currentIndex,
    active: index === currentIndex,
  }));
}

function StatusIllustration({ type }) {
  return (
    <div className={styles.illustration} aria-hidden="true">
      <div className={styles.pulseOne} />
      <div className={styles.pulseTwo} />

      {type === "headset" ? (
        <svg viewBox="0 0 80 80" className={styles.illustrationSvg}>
          <path
            d="M18 43v-7c0-13 9.8-23 22-23s22 10 22 23v7"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect x="10" y="39" width="15" height="20" rx="7" fill="currentColor" />
          <rect x="55" y="39" width="15" height="20" rx="7" fill="currentColor" />
          <path
            d="M62 57c-2 8-8 12-18 12h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="34" cy="69" r="5" fill="currentColor" />
        </svg>
      ) : type === "driver" ? (
        <svg viewBox="0 0 80 80" className={styles.illustrationSvg}>
          <circle cx="40" cy="24" r="12" fill="currentColor" />
          <path
            d="M21 64c3-16 12-24 19-24s16 8 19 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M24 21l16-8 16 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : type === "radar" ? (
        <svg viewBox="0 0 80 80" className={styles.illustrationSvg}>
          <circle cx="40" cy="40" r="25" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="40" cy="40" r="13" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="40" cy="40" r="4" fill="currentColor" />
          <path
            d="M40 40l21-13"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 80 80" className={styles.illustrationSvg}>
          <path
            d="M18 28l22-12 22 12v25L40 65 18 53V28z"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M18 28l22 13 22-13M40 41v24"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();

  const flow = (() => {
    try {
      return useFlow();
    } catch {
      return {};
    }
  })();

  const reset = flow?.reset;

  const [pedido, setPedido] = useState(null);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("NuevoPedido");
      setPedido(raw ? JSON.parse(raw) : null);
    } catch {
      setPedido(null);
    }
  }, []);

  const pedidoId = pedido?.id ? String(pedido.id) : "";

  useEffect(() => {
    if (!pedidoId) return;

    const pedidoRef = doc(db, "orders", pedidoId);

    const unsubscribe = onSnapshot(
      pedidoRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();

        const pedidoActualizado = {
          ...data,
          id: data.id || snapshot.id,
          createdAt: formatTimestamp(data.createdAt),
          lastUpdate: formatTimestamp(data.lastUpdate),
          assignedAt: formatTimestamp(data.assignedAt),
          serverReviewAt: formatTimestamp(data.serverReviewAt),
          finishedAt: formatTimestamp(data.finishedAt),
        };

        setPedido((prev) => {
          const merged = {
            ...(prev || {}),
            ...pedidoActualizado,
          };

          localStorage.setItem("NuevoPedido", JSON.stringify(merged));

          return merged;
        });
      },
      (error) => {
        console.error("[CHECKOUT][ORDER_LISTENER] Error escuchando pedido:", error);
      }
    );

    return () => unsubscribe();
  }, [pedidoId]);

  const waitingState = useMemo(() => getCheckoutWaitingState(pedido), [pedido]);

  const mensajes = waitingState.messages;

  useEffect(() => {
    setMsgIdx(0);
  }, [waitingState.title]);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % mensajes.length);
    }, 3500);

    return () => clearInterval(id);
  }, [mensajes]);

  const precio = useMemo(() => {
    const p = Number(pedido?.price || pedido?.breakdown?.total || 0);
    return p > 0 ? p : 0;
  }, [pedido]);

  const tieneRepartidorAsignado = hasAssignedDriver(pedido);

  const handleCancelar = () => {
    if (!confirm("¿Seguro que querés cancelar este pedido?")) return;
    cancelActualAndArchive();
    reset?.();
    navigate("/orders", { replace: true });
  };

  const handleInicio = () => navigate("/home");

  const handlePedidos = () => navigate("/orders");

  if (!pedido) {
    return (
      <div className={styles.screen}>
        <main className={styles.emptyScreen}>
          <div className={styles.emptyCard}>
            <div className={styles.emptyIcon}>{boxIcon}</div>
            <h1>No hay pedido en proceso</h1>
            <p>Creá un nuevo envío o retiro desde la pantalla principal.</p>

            <button
              className={styles.primaryBtn}
              type="button"
              onClick={handleInicio}
            >
              Ir al inicio
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (tieneRepartidorAsignado) {
    return <TrackingPedido pedido={pedido} />;
  }

  const progressSteps = getProgressSteps(waitingState);
  const pickupAddress = getPickupAddress(pedido);
  const dropoffAddress = getDropoffAddress(pedido);
  const pickupContact = getPickupContact(pedido);
  const dropoffContact = getDropoffContact(pedido);
  const paymentLabel = formatPayment(pedido);

  return (
    <div className={styles.screen}>
      <main className={styles.main}>
        <section className={`${styles.heroCard} ${styles[waitingState.tone]}`}>
          <header className={styles.topBar}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={handleInicio}
              aria-label="Ir al inicio"
            >
              ←
            </button>

            <span className={styles.badge}>{waitingState.badge}</span>
          </header>

          <div className={styles.heroContent}>
            <StatusIllustration type={waitingState.visual} />

            <div className={styles.heroText}>
              <span className={styles.kicker}>Pedido {shortOrderId(pedido.id)}</span>
              <h1>{waitingState.title}</h1>
              <h2>{waitingState.headline}</h2>
              <p>{waitingState.description}</p>
            </div>
          </div>

          <div className={styles.liveMessage}>
            <span className={styles.liveDot} aria-hidden="true" />
            <strong key={msgIdx}>{mensajes[msgIdx]}</strong>
          </div>
        </section>

        <section className={styles.timelineCard} aria-label="Progreso del pedido">
          <div className={styles.sectionHeader}>
            <span>Seguimiento</span>
            <strong>Tu pedido se actualiza solo</strong>
          </div>

          <div className={styles.timeline}>
            {progressSteps.map((step) => (
              <div
                key={step.key}
                className={`${styles.timelineStep} ${
                  step.done ? styles.stepDone : ""
                } ${step.active ? styles.stepActive : ""}`}
              >
                <span className={styles.stepCircle}>
                  {step.done ? "✓" : step.active ? "•" : ""}
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.helper}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.routeCard} aria-label="Resumen del pedido">
          <div className={styles.sectionHeader}>
            <span>Resumen</span>
            <strong>Retiro y entrega</strong>
          </div>

          <div className={styles.routeList}>
            <div className={styles.routeItem}>
              <div className={`${styles.routeIcon} ${styles.pickupIcon}`}>
                {pinIcon}
              </div>

              <div className={styles.routeText}>
                <span>Punto de retiro</span>
                <strong>{pickupAddress}</strong>
                {pickupContact && <small>{pickupContact}</small>}
              </div>
            </div>

            <div className={styles.routeConnector} />

            <div className={styles.routeItem}>
              <div className={`${styles.routeIcon} ${styles.dropoffIcon}`}>
                {targetIcon}
              </div>

              <div className={styles.routeText}>
                <span>Punto de entrega</span>
                <strong>{dropoffAddress}</strong>
                {dropoffContact && <small>{dropoffContact}</small>}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.paymentCard} aria-label="Pago del pedido">
          <div className={styles.paymentMain}>
            <div>
              <span>Total del pedido</span>
              <strong>{formatMoney(precio)}</strong>
            </div>

            <div className={styles.paymentBadge}>
              {paymentIcon}
              <span>{paymentLabel}</span>
            </div>
          </div>

          <div className={styles.metaGrid}>
            <div>
              <span>Distancia</span>
              <strong>{formatDistance(pedido.km)}</strong>
            </div>

            <div>
              <span>Servicio</span>
              <strong>{pedido.serviceType || "Simple"}</strong>
            </div>

            <div>
              <span>Gestión</span>
              <strong>
                {pedido.assignmentStatus === "fallback_to_local"
                  ? "Central"
                  : "Online"}
              </strong>
            </div>
          </div>
        </section>

        <section className={styles.reassureCard}>
          <div className={styles.reassureIcon}>{sparkIcon}</div>
          <p>{waitingState.reassure}</p>
        </section>
      </main>

      <footer className={styles.footer}>
        <button
          className={styles.secondaryBtn}
          type="button"
          onClick={handleCancelar}
        >
          Cancelar
        </button>

        <button
          className={styles.ghostBtn}
          type="button"
          onClick={handlePedidos}
        >
          Mis pedidos
        </button>

        <button
          className={styles.primaryBtn}
          type="button"
          onClick={handleInicio}
        >
          Ir al inicio
        </button>
      </footer>
    </div>
  );
}

const pinIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const targetIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);

const paymentIcon = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M7 10h.01M17 14h.01" />
    <circle cx="12" cy="12" r="2.2" />
  </svg>
);

const sparkIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
  </svg>
);

const boxIcon = (
  <svg viewBox="0 0 80 80" width="54" height="54" fill="none" stroke="currentColor" strokeWidth="5">
    <path d="M18 28l22-12 22 12v25L40 65 18 53V28z" />
    <path d="M18 28l22 13 22-13M40 41v24" />
  </svg>
);