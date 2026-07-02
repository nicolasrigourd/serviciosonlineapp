import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { useFlow } from "../../state/FlowContext";
import styles from "./Checkout.module.css";
import { db } from "../../services/firebase";
import { loadOrderByIdDb, cancelOrderDb, patchOrderDb } from "../../lib/pedidosStore";
import TrackingPedido from "../../components/TrackingPedido/TrackingPedido";

function norm(value) {
  return String(value || "").toLowerCase().trim();
}

function getOrderId(pedido) {
  return String(pedido?.orderId || pedido?._docId || "").trim();
}

function getServerStatus(pedido) {
  return norm(pedido?.server?.status);
}

function getAssignmentStatus(pedido) {
  return norm(pedido?.assignment?.status);
}

function getOrderStatus(pedido) {
  return norm(pedido?.status);
}

function getOfferStatus(pedido) {
  return norm(pedido?.offer?.status);
}

function getDeliveryStep(pedido) {
  return norm(pedido?.delivery?.currentStep || "");
}

function getDeliveryStatus(pedido) {
  return norm(pedido?.delivery?.operationalStatus || "");
}

/*
  IMPORTANTE:
  offer.driver NO es repartidor asignado.
  offer.driver es solo el candidato/oferta enviada.
  El repartidor real asignado vive en assignment.assignedDriver.
*/
function getAssignedDriver(pedido) {
  return pedido?.assignment?.assignedDriver || null;
}

function hasAssignedDriver(pedido) {
  const status = getOrderStatus(pedido);
  const assignmentStatus = getAssignmentStatus(pedido);
  const serverStatus = getServerStatus(pedido);

  return Boolean(
    status === "assigned" ||
      assignmentStatus === "assigned" ||
      serverStatus === "matched" ||
      pedido?.assignedDriverId ||
      pedido?.assignment?.assignedDriverId
  );
}

function isCompleted(pedido) {
  const status = getOrderStatus(pedido);
  const step = getDeliveryStep(pedido);
  const deliveryStatus = getDeliveryStatus(pedido);

  return (
    status === "completed" ||
    status === "delivered" ||
    step === "delivered" ||
    deliveryStatus === "delivered"
  );
}

function isCancelled(pedido) {
  const status = getOrderStatus(pedido);
  return status === "cancelled" || status === "canceled";
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

  const status = getOrderStatus(pedido);
  const serverStatus = getServerStatus(pedido);
  const assignmentStatus = getAssignmentStatus(pedido);
  const offerStatus = getOfferStatus(pedido);
  const deliveryStep = getDeliveryStep(pedido);
  const deliveryStatus = getDeliveryStatus(pedido);
  const assignmentManager = norm(pedido?.assignment?.manager);

  if (isCancelled(pedido)) {
    return {
      title: "Pedido cancelado",
      headline: "La solicitud fue cancelada",
      description:
        "Este pedido ya no se encuentra activo. Podés crear un nuevo envío cuando quieras.",
      reassure: "No se continuará buscando repartidor para este pedido.",
      messages: ["Pedido cancelado…"],
      badge: "CANCELADO",
      tone: "central",
      visual: "box",
      currentStep: "created",
    };
  }

  if (isCompleted(pedido)) {
    return {
      title: "Pedido entregado",
      headline: "Tu envío fue finalizado",
      description:
        "El repartidor marcó la entrega como completada. Gracias por usar el servicio.",
      reassure: "Podés consultar este pedido desde tu historial.",
      messages: ["Pedido finalizado…"],
      badge: "ENTREGADO",
      tone: "central",
      visual: "box",
      currentStep: "dropoff",
    };
  }

  if (serverStatus === "fallback_local" || assignmentManager === "engine") {
    return {
      title: "Lo gestiona la central",
      headline: "Tu pedido no queda sin atención",
      description:
        "No encontramos disponibilidad automática por ahora. La central local va a coordinarlo manualmente.",
      reassure: "Podés volver al inicio tranquilo. Te avisaremos cuando avance.",
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

  if (serverStatus === "retrying_match") {
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
    status === "offering" ||
    serverStatus === "waiting_driver_response" ||
    assignmentStatus === "offering" ||
    offerStatus === "pending"
  ) {
    return {
      title: "Un repartidor está revisando tu pedido",
      headline: "Esperando respuesta",
      description:
        "Le enviamos la solicitud a un repartidor cercano. Estamos esperando que confirme si puede tomarlo.",
      reassure: "Apenas responda, actualizamos el seguimiento automáticamente.",
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
    status === "assigned" ||
    assignmentStatus === "assigned" ||
    serverStatus === "matched"
  ) {
    if (deliveryStep === "started_pickup" || deliveryStatus === "started_pickup") {
      return {
        title: "El repartidor va al origen",
        headline: "En camino al punto de retiro",
        description:
          "El repartidor ya comenzó el recorrido hacia el punto de retiro.",
        reassure: "El seguimiento se actualizará cuando llegue al origen.",
        messages: [
          "Repartidor en camino al origen…",
          "Actualizando recorrido…",
          "Seguimiento activo…",
        ],
        badge: "EN CAMINO",
        tone: "offering",
        visual: "driver",
        currentStep: "pickup",
      };
    }

    if (deliveryStep === "arrived_pickup" || deliveryStatus === "arrived_pickup") {
      return {
        title: "El repartidor llegó al origen",
        headline: "Retiro en proceso",
        description:
          "El repartidor está en el punto de retiro y está preparando la salida hacia el destino.",
        reassure: "Te avisaremos cuando el pedido sea retirado.",
        messages: [
          "Repartidor en origen…",
          "Esperando retiro del pedido…",
          "Validando datos del retiro…",
        ],
        badge: "EN ORIGEN",
        tone: "offering",
        visual: "driver",
        currentStep: "pickup",
      };
    }

    if (deliveryStep === "go_to_dropoff" || deliveryStatus === "picked_up") {
      return {
        title: "Pedido retirado",
        headline: "El repartidor va hacia el destino",
        description:
          "El pedido ya fue retirado y el repartidor se dirige al punto de entrega.",
        reassure: "El seguimiento se actualizará cuando llegue al destino.",
        messages: [
          "Pedido retirado…",
          "En camino al destino…",
          "Actualizando seguimiento…",
        ],
        badge: "EN VIAJE",
        tone: "offering",
        visual: "driver",
        currentStep: "dropoff",
      };
    }

    if (
      deliveryStep === "arrived_dropoff" ||
      deliveryStatus === "arrived_dropoff"
    ) {
      return {
        title: "El repartidor llegó al destino",
        headline: "Entrega en proceso",
        description:
          "El repartidor está en el punto de entrega. El pedido está por finalizar.",
        reassure: "Te avisaremos cuando se marque como entregado.",
        messages: [
          "Repartidor en destino…",
          "Entrega en proceso…",
          "Finalizando pedido…",
        ],
        badge: "EN DESTINO",
        tone: "offering",
        visual: "driver",
        currentStep: "dropoff",
      };
    }

    return {
      title: "Repartidor asignado",
      headline: "Tu pedido ya fue tomado",
      description:
        "Un repartidor aceptó tu pedido. En breve comenzará el recorrido hacia el punto de retiro.",
      reassure: "Ya podés seguir el avance del pedido en tiempo real.",
      messages: [
        "Repartidor asignado…",
        "Preparando recorrido…",
        "Seguimiento activado…",
      ],
      badge: "ASIGNADO",
      tone: "offering",
      visual: "driver",
      currentStep: "assigned",
    };
  }

  if (
    serverStatus === "validated_online" ||
    serverStatus === "pending_validation" ||
    assignmentStatus === "unassigned" ||
    status === "pending"
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

  return null;
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
    pedido?.pickup?.input ||
    "Punto de retiro no informado"
  );
}

function getDropoffAddress(pedido) {
  return (
    pedido?.dropoff?.address ||
    pedido?.dropoff?.input ||
    "Punto de entrega no informado"
  );
}

function getPickupContact(pedido) {
  return pedido?.pickup?.contact?.fullName || "";
}

function getDropoffContact(pedido) {
  return (
    pedido?.dropoff?.contact?.fullName ||
    pedido?.recipient?.name ||
    ""
  );
}

function formatPayment(pedido) {
  const method = pedido?.payment?.method;
  const provider = pedido?.payment?.provider;

  if (method === "cash") return "Efectivo";
  if (method === "digital" && provider === "mercadopago") return "MercadoPago";
  if (method === "digital") return "Digital";

  return pedido?.payment?.label || "No informado";
}

function getPrice(pedido) {
  return pedido?.pricing?.price ?? pedido?.payment?.amount ?? 0;
}

function getDistanceKm(pedido) {
  return pedido?.route?.distanceKm ?? 0;
}

function getServiceLabel(pedido) {
  return pedido?.service?.label || pedido?.service?.type || "Simple";
}

function getDriverName(pedido) {
  const driver = getAssignedDriver(pedido);

  return (
    driver?.fullName ||
    [driver?.firstName, driver?.lastName].filter(Boolean).join(" ") ||
    "Repartidor asignado"
  );
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
      helper: "confirmado",
    },
    {
      key: "pickup",
      label: "Retiro",
      helper: "en proceso",
    },
    {
      key: "dropoff",
      label: "Entrega",
      helper: "pendiente",
    },
  ];

  const order = ["created", "searching", "assigned", "pickup", "dropoff"];
  const currentIndex =
    current === "central" ? 1 : Math.max(0, order.indexOf(current));

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
          <circle
            cx="40"
            cy="40"
            r="25"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <circle
            cx="40"
            cy="40"
            r="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
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
  const [searchParams] = useSearchParams();
  const orderIdFromUrl = searchParams.get("orderId");

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
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Carga inicial desde Dexie por orderId en URL
  useEffect(() => {
    if (!orderIdFromUrl) { setPedido(null); return; }
    loadOrderByIdDb(orderIdFromUrl).then((order) => setPedido(order || null));
  }, [orderIdFromUrl]);

  const pedidoId = getOrderId(pedido);

  // Listener Firestore → actualiza Dexie + estado local
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
          _docId: snapshot.id,
          orderId: data.orderId || snapshot.id,

          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
          assignedAt: formatTimestamp(data.assignment?.assignedAt),
          serverReviewAt: formatTimestamp(data.server?.reviewAt),
          finishedAt: formatTimestamp(data.delivery?.finishedAt),
        };

        setPedido((prev) => {
          const merged = { ...(prev || {}), ...pedidoActualizado };
          patchOrderDb(pedidoId, merged).catch(() => {});
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
    return Number(getPrice(pedido) || 0);
  }, [pedido]);

  const tieneRepartidorAsignado = hasAssignedDriver(pedido);

  const handleCancelar = () => setConfirmCancel(true);

  const confirmCancelOrder = async () => {
    setConfirmCancel(false);
    const id = getOrderId(pedido);
    try {
      if (id) {
        await updateDoc(doc(db, "orders", id), {
          status: "cancelled",
          updatedAt: serverTimestamp(),
          updatedAtMs: Date.now(),
          "cancellation.cancelledAt": serverTimestamp(),
          "cancellation.cancelledAtMs": Date.now(),
          "cancellation.reason": "customer_cancelled_from_checkout",
        });
        await cancelOrderDb(id);
      }
    } catch (error) {
      console.error("[CHECKOUT][CANCEL] Error cancelando pedido:", error);
    }
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
  const driverName = getDriverName(pedido);

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
              <span className={styles.kicker}>
                Pedido {shortOrderId(getOrderId(pedido))}
              </span>
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

        {hasAssignedDriver(pedido) && (
          <section className={styles.reassureCard}>
            <div className={styles.reassureIcon}>{driverMiniIcon}</div>
            <p>{driverName}</p>
          </section>
        )}

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
              <strong>{formatDistance(getDistanceKm(pedido))}</strong>
            </div>

            <div>
              <span>Servicio</span>
              <strong>{getServiceLabel(pedido)}</strong>
            </div>

            <div>
              <span>Gestión</span>
              <strong>
                {pedido?.assignment?.manager === "engine" ||
                getServerStatus(pedido) === "fallback_local"
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
        {!hasAssignedDriver(pedido) &&
          !isCompleted(pedido) &&
          !isCancelled(pedido) && (
            <button
              className={styles.secondaryBtn}
              type="button"
              onClick={handleCancelar}
            >
              Cancelar
            </button>
          )}

        <button className={styles.ghostBtn} type="button" onClick={handlePedidos}>
          Mis pedidos
        </button>

        <button className={styles.primaryBtn} type="button" onClick={handleInicio}>
          Ir al inicio
        </button>
      </footer>

      {confirmCancel && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmCancel(false)}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIconWrap}>{alertIcon}</div>
            <h3 className={styles.confirmTitle}>¿Cancelar el pedido?</h3>
            <p className={styles.confirmText}>
              El pedido dejará de estar activo y no se podrá recuperar.
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmKeep} onClick={() => setConfirmCancel(false)}>
                Mantener
              </button>
              <button type="button" className={styles.confirmDanger} onClick={confirmCancelOrder}>
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const alertIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const pinIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const targetIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);

const paymentIcon = (
  <svg
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M7 10h.01M17 14h.01" />
    <circle cx="12" cy="12" r="2.2" />
  </svg>
);

const sparkIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
  </svg>
);

const driverMiniIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="7" r="4" />
    <path d="M5 21a7 7 0 0 1 14 0" />
  </svg>
);

const boxIcon = (
  <svg
    viewBox="0 0 80 80"
    width="54"
    height="54"
    fill="none"
    stroke="currentColor"
    strokeWidth="5"
  >
    <path d="M18 28l22-12 22 12v25L40 65 18 53V28z" />
    <path d="M18 28l22 13 22-13M40 41v24" />
  </svg>
);