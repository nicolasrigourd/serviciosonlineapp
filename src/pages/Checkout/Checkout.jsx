
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../../state/FlowContext";
import styles from "./Checkout.module.css";
import { loadActual, cancelActualAndArchive } from "../../lib/pedidosStore";

export default function Checkout() {
  const navigate = useNavigate();
  const flow = (() => {
    try { return useFlow(); } catch { return {}; }
  })();
  const reset = flow?.reset;

  const [pedido, setPedido] = useState(null);

  // Cargar pedido desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("NuevoPedido");
      setPedido(raw ? JSON.parse(raw) : null);
    } catch {
      setPedido(null);
    }
  }, []);

  const precio = useMemo(() => {
    const p = Number(pedido?.price || 0);
    return p > 0 ? p : 0;
  }, [pedido]);

 const handleCancelar = () => {
  if (!confirm("¿Seguro que querés cancelar este pedido?")) return;
  cancelActualAndArchive();              // ✅ centralizado
  navigate("/orders", { replace: true }); // te lleva a Mis pedidos
};

  const handleInicio = () => navigate("/home");

  // Mensajes rotativos (con fade)
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
            <button className={styles.primaryBtn} type="button" onClick={handleInicio}>
              Ir al inicio
            </button>
          </div>
        </main>

        <section className={`${styles.progressDock} ${styles.progressDockEmpty}`} aria-hidden="true" />

        <footer className={styles.footer}>
          <button className={styles.secondaryBtn} type="button" onClick={handleInicio}>
            Volver
          </button>
          <button className={styles.primaryBtn} type="button" onClick={handleInicio}>
            Ir al inicio
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Estamos preparando tu envío</h1>
        {pedido?.serviceType && (
          <span className={styles.badge}>{String(pedido.serviceType).toUpperCase()}</span>
        )}
      </header>

      {/* Cards arriba */}
      <main className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Tu envío</h2>
          <div className={styles.kv}><span className={styles.k}>ID</span><span className={styles.v}>{pedido.id}</span></div>
          <div className={styles.kv}><span className={styles.k}>Origen</span><span className={styles.v}>{pedido.origin || "—"}</span></div>
          <div className={styles.kv}><span className={styles.k}>Destino</span><span className={styles.v}>{pedido.destination || "—"}</span></div>
          <div className={styles.kv}><span className={styles.k}>Distancia</span><span className={styles.v}>{pedido.km ? `${pedido.km} km` : "—"}</span></div>
          <div className={`${styles.kv} ${styles.totalRow}`}>
            <span className={styles.k}>Total</span>
            <span className={styles.total}>{precio ? `$${precio.toLocaleString("es-AR")}` : "—"}</span>
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

      {/* Barra inferior con mensaje de tranquilidad + mensaje rotativo (con fade) */}
      <section className={styles.progressDock} aria-label="Estado del pedido">
        <p className={`${styles.reassure} ${styles.fadeOnMount}`}>
          Ya podés relajarte. Te avisaremos cuando se asigne un repartidor.
        </p>

        <div className={styles.progressBar}>
          <div className={styles.progressIndeterminate} />
        </div>

        {/* key=msgIdx → re-monta el nodo y dispara la animación de fade */}
        <p className={`${styles.progressMsg} ${styles.fade}`} key={msgIdx}>
          {mensajes[msgIdx]}
        </p>
      </section>

      <footer className={styles.footer}>
        <button className={styles.secondaryBtn} type="button" onClick={handleCancelar}>
          Cancelar pedido
        </button>
        <button className={styles.primaryBtn} type="button" onClick={handleInicio}>
          Ir al inicio
        </button>
      </footer>
    </div>
  );
}
