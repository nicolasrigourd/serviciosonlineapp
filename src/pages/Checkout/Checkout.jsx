import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";

import { useFlow } from "../../state/FlowContext";
import styles from "./Checkout.module.css";
import { db } from "../../services/firebase";
import { cancelActualAndArchive } from "../../lib/pedidosStore";
import TrackingPedido from "../../components/TrackingPedido/TrackingPedido";

function getCheckoutWaitingState(pedido) {
  if (!pedido) {
    return {
      title: "Estamos preparando tu envío",
      reassure: "Estamos registrando tu pedido.",
      messages: ["Preparando solicitud…"],
      badge: "PROCESANDO",
    };
  }

  if (
    pedido?.assignmentStatus === "fallback_to_local" ||
    pedido?.serverStatus === "fallback_local"
  ) {
    return {
      title: "Tu pedido fue derivado a la central",
      reassure:
        "La central local gestionará manualmente la asignación para que tu envío no quede sin atención.",
      messages: [
        "Derivado a gestión local…",
        "Coordinando disponibilidad…",
        "Te avisaremos cuando sea asignado…",
      ],
      badge: "CENTRAL",
    };
  }

  if (pedido?.serverStatus === "retrying_match") {
    return {
      title: "Estamos buscando otro repartidor",
      reassure:
        "El primer intento no se concretó, pero seguimos buscando disponibilidad cercana.",
      messages: [
        "Buscando otro repartidor…",
        "Reintentando asignación…",
        "Verificando disponibilidad cercana…",
      ],
      badge: "REINTENTO",
    };
  }

  if (
    pedido?.status === "ofertando" ||
    pedido?.serverStatus === "waiting_driver_response" ||
    pedido?.assignmentStatus === "offering"
  ) {
    return {
      title: "Estamos consultando a un repartidor",
      reassure:
        "Un repartidor cercano recibió la solicitud y estamos esperando su respuesta.",
      messages: [
        "Esperando respuesta del repartidor…",
        "Solicitud enviada…",
        "Validando disponibilidad…",
      ],
      badge: "OFERTANDO",
    };
  }

  if (
    pedido?.serverStatus === "validated_online" ||
    pedido?.assignmentStatus === "unassigned" ||
    pedido?.status === "pendiente"
  ) {
    return {
      title: "Estamos buscando repartidor",
      reassure:
        "Ya registramos tu pedido. Estamos buscando un repartidor disponible para tomarlo.",
      messages: [
        "Buscando repartidores…",
        "Optimizando ruta…",
        "Verificando cobertura…",
        "Analizando disponibilidad cercana…",
      ],
      badge: "BUSCANDO",
    };
  }

  return {
    title: "Estamos preparando tu envío",
    reassure: "Ya podés relajarte. Te avisaremos cuando se asigne un repartidor.",
    messages: [
      "Buscando repartidores…",
      "Optimizando ruta…",
      "Verificando cobertura…",
      "Mejorando la experiencia…",
    ],
    badge: "EN PROCESO",
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

  const waitingState = useMemo(
    () => getCheckoutWaitingState(pedido),
    [pedido]
  );

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

  if (!pedido) {
    return (
      <div className={styles.screen}>
        <header className={styles.header}>
          <h1 className={styles.title}>Checkout</h1>
          <span className={styles.badge}>Sin pedido</span>
        </header>

        <main className={styles.mainEmpty}>
          <div className={styles.emptyCard}>
            <h2 className={styles.emptyTitle}>No hay pedido en proceso</h2>
            <p className={styles.emptyText}>
              Creá un nuevo envío desde la pantalla principal.
            </p>

            <button
              className={styles.primaryBtn}
              type="button"
              onClick={handleInicio}
            >
              Ir al inicio
            </button>
          </div>
        </main>

        <section
          className={`${styles.progressDock} ${styles.progressDockEmpty}`}
          aria-hidden="true"
        />

        <footer className={styles.footer}>
          <button
            className={styles.secondaryBtn}
            type="button"
            onClick={handleInicio}
          >
            Volver
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

  if (tieneRepartidorAsignado) {
    return <TrackingPedido pedido={pedido} />;
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{waitingState.title}</h1>

        <span className={styles.badge}>
          {waitingState.badge || String(pedido.serviceType || "ENVÍO").toUpperCase()}
        </span>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Tu envío</h2>

          <div className={styles.kv}>
            <span className={styles.k}>ID</span>
            <span className={styles.v}>{pedido.id}</span>
          </div>

          <div className={styles.kv}>
            <span className={styles.k}>Origen</span>
            <span className={styles.v}>
              {pedido.originInput || pedido.origin || "—"}
            </span>
          </div>

          <div className={styles.kv}>
            <span className={styles.k}>Destino</span>
            <span className={styles.v}>
              {pedido.destinationInput || pedido.destination || "—"}
            </span>
          </div>

          <div className={styles.kv}>
            <span className={styles.k}>Distancia</span>
            <span className={styles.v}>
              {pedido.km ? `${pedido.km} km` : "—"}
            </span>
          </div>

          <div className={`${styles.kv} ${styles.totalRow}`}>
            <span className={styles.k}>Total</span>
            <span className={styles.total}>
              {precio ? `$${precio.toLocaleString("es-AR")}` : "—"}
            </span>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Estado actual</h2>

          <ul className={styles.bullets}>
            <li>{waitingState.reassure}</li>

            {pedido?.serverStatus && (
              <li>Estado del servidor: {pedido.serverStatus}</li>
            )}

            {pedido?.assignmentStatus && (
              <li>Asignación: {pedido.assignmentStatus}</li>
            )}
          </ul>
        </section>

        <section className={`${styles.card} ${styles.cardStats}`}>
          <h2 className={styles.cardTitle}>Seguimiento</h2>

          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={styles.statNum}>
                {pedido?.serverStatus === "retrying_match" ? "2°" : "1°"}
              </div>
              <div className={styles.statLbl}>Intento</div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statNum}>
                {pedido?.assignmentStatus === "fallback_to_local" ? "Local" : "Online"}
              </div>
              <div className={styles.statLbl}>Gestión</div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statNum}>
                {pedido?.serverStatus === "waiting_driver_response"
                  ? "..."
                  : "OK"}
              </div>
              <div className={styles.statLbl}>Sistema</div>
            </div>
          </div>
        </section>
      </main>

      <section className={styles.progressDock} aria-label="Estado del pedido">
        <p className={`${styles.reassure} ${styles.fadeOnMount}`}>
          {waitingState.reassure}
        </p>

        <div className={styles.progressBar}>
          <div className={styles.progressIndeterminate} />
        </div>

        <p className={`${styles.progressMsg} ${styles.fade}`} key={msgIdx}>
          {mensajes[msgIdx]}
        </p>
      </section>

      <footer className={styles.footer}>
        <button
          className={styles.secondaryBtn}
          type="button"
          onClick={handleCancelar}
        >
          Cancelar pedido
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