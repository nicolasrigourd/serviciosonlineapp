import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { loadActiveOrdersDb } from "../../lib/pedidosStore";
import OrderTrackingModal from "../OrderTrackingModal/OrderTrackingModal";
import styles from "./OrdersDock.module.css";

const norm = (s) => String(s || "").toLowerCase().trim();

function getStatusInfo(order) {
  const status = norm(order?.status);
  const step   = norm(order?.delivery?.currentStep || "");
  const hasDriver = Boolean(
    order?.assignment?.assignedDriverId || order?.assignedDriverId
  );

  if (status === "pending" || status === "pendiente") {
    return { label: "Buscando repartidor", tone: "searching" };
  }
  if (status === "offering" || status === "ofertando") {
    return { label: "Oferta enviada al repartidor", tone: "offering" };
  }
  if (step === "started_pickup") {
    return { label: "Repartidor en camino al origen", tone: "moving" };
  }
  if (step === "arrived_pickup") {
    return { label: "Repartidor en el punto de retiro", tone: "moving" };
  }
  if (step === "go_to_dropoff") {
    return { label: "Pedido retirado · en camino", tone: "moving" };
  }
  if (step === "arrived_dropoff") {
    return { label: "Repartidor en el destino", tone: "moving" };
  }
  if (hasDriver || status === "assigned" || status === "asignado") {
    return { label: "Repartidor asignado", tone: "assigned" };
  }
  return { label: "Pedido en curso", tone: "searching" };
}

function shortId(id) {
  const v = String(id || "");
  return v.length > 8 ? `#${v.slice(-6)}` : `#${v}`;
}

function StatusDot({ tone }) {
  return <span className={`${styles.dot} ${styles[`dot_${tone}`]}`} aria-hidden="true" />;
}

export default function OrdersDock() {
  const navigate = useNavigate();
  const [orders,     setOrders]     = useState([]);
  const [trackingId, setTrackingId] = useState(null);

  const reload = useCallback(() => {
    loadActiveOrdersDb().then((list) =>
      setOrders(list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)))
    );
  }, []);

  useEffect(() => {
    reload();
    const onVisible = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  if (orders.length === 0) return null;

  // Orden prioritario: el más activo (assigned > offering > pending)
  const PRIORITY = { moving: 0, assigned: 1, offering: 2, searching: 3 };
  const primary = [...orders].sort((a, b) => {
    const ta = PRIORITY[getStatusInfo(a).tone] ?? 9;
    const tb = PRIORITY[getStatusInfo(b).tone] ?? 9;
    return ta - tb;
  })[0];

  const orderId = primary.orderId || primary.id;
  const { label, tone } = getStatusInfo(primary);
  const extraCount = orders.length - 1;

  const openPrimary = () => setTrackingId(orderId);

  return (
    <>
      <div className={styles.dock} onClick={openPrimary} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && openPrimary()}
        aria-label={`Pedido activo ${shortId(orderId)} — ${label}. Presioná para ver`}
      >
        {/* Barra principal */}
        <div className={styles.bar}>

          <div className={styles.left}>
            <StatusDot tone={tone} />
            <div className={styles.textBlock}>
              <span className={styles.orderId}>{shortId(orderId)}</span>
              <span className={styles.statusLabel}>{label}</span>
            </div>
          </div>

          <div className={styles.right}>
            {extraCount > 0 && (
              <button
                type="button"
                className={styles.extraBadge}
                onClick={(e) => { e.stopPropagation(); navigate("/orders"); }}
                aria-label={`Ver ${extraCount} pedido${extraCount > 1 ? "s" : ""} más`}
              >
                +{extraCount} más
              </button>
            )}
            <div className={styles.verCue} aria-hidden="true">
              <span>Ver</span>
              {chevronIcon}
            </div>
          </div>

        </div>

        {/* Barra de progreso animada */}
        <div className={styles.progressTrack}>
          <div className={`${styles.progressFill} ${styles[`fill_${tone}`]}`} />
        </div>
      </div>

      {trackingId && (
        <OrderTrackingModal
          orderId={trackingId}
          onClose={() => { setTrackingId(null); reload(); }}
        />
      )}
    </>
  );
}

const chevronIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 15l-6-6-6 6"/>
  </svg>
);
