import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";

import { useFlow } from "../../state/FlowContext";
import styles from "./Checkout.module.css";
import { db } from "../../services/firebase";
import { loadActual, cancelActualAndArchive } from "../../lib/pedidosStore";
import TrackingPedido from "../../components/TrackingPedido/TrackingPedido";

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
          createdAt:
            data.createdAt?.toDate?.()?.toISOString?.() ||
            data.createdAt ||
            null,
          lastUpdate:
            data.lastUpdate?.toDate?.()?.toISOString?.() ||
            data.lastUpdate ||
            null,
          assignedAt:
            data.assignedAt?.toDate?.()?.toISOString?.() ||
            data.assignedAt ||
            null,
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

  const precio = useMemo(() => {
    const p = Number(pedido?.price || 0);
    return p > 0 ? p : 0;
  }, [pedido]);

  const tieneRepartidorAsignado = Boolean(
    pedido?.assignedCadete?.id ||
      pedido?.assignedCadete?.cadeteId ||
      pedido?.assignedCadete?.nombre
  );

  const handleCancelar = () => {
    if (!confirm("¿Seguro que querés cancelar este pedido?")) return;
    cancelActualAndArchive();
    navigate("/orders", { replace: true });
  };

  const handleInicio = () => navigate("/home");

  const mensajes = [
    "Buscando repartidores…",
    "Optimizando ruta…",
    "Verificando cobertura…",
    "Mejorando la experiencia…",
  ];

  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % mensajes.length);
    }, 3500);

    return () => clearInterval(id);
  }, []);

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
        <h1 className={styles.title}>Estamos preparando tu envío</h1>

        {pedido?.serviceType && (
          <span className={styles.badge}>
            {String(pedido.serviceType).toUpperCase()}
          </span>
        )}
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
            <span className={styles.v}>{pedido.origin || "—"}</span>
          </div>

          <div className={styles.kv}>
            <span className={styles.k}>Destino</span>
            <span className={styles.v}>{pedido.destination || "—"}</span>
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
          <h2 className={styles.cardTitle}>Confianza</h2>

          <ul className={styles.bullets}>
            <li>+50.000 entregas realizadas.</li>
            <li>Tiempo promedio de asignación: 3–7 minutos.</li>
            <li>Soporte en línea en tiempo real.</li>
          </ul>
        </section>

        <section className={`${styles.card} ${styles.cardStats}`}>
          <h2 className={styles.cardTitle}>Satisfacción</h2>

          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={styles.statNum}>4.8★</div>
              <div className={styles.statLbl}>Valoración</div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statNum}>92%</div>
              <div className={styles.statLbl}>A tiempo</div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statNum}>24/7</div>
              <div className={styles.statLbl}>Soporte</div>
            </div>
          </div>
        </section>
      </main>

      <section className={styles.progressDock} aria-label="Estado del pedido">
        <p className={`${styles.reassure} ${styles.fadeOnMount}`}>
          Ya podés relajarte. Te avisaremos cuando se asigne un repartidor.
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