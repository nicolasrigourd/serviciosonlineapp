// src/components/ActiveOrderSheet/ActiveOrderSheet.jsx

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadActiveOrdersDb } from "../../lib/pedidosStore";
import styles from "./ActiveOrderSheet.module.css";

const SHEET_COLLAPSED = "collapsed";
const SHEET_PEEK = "peek";
const SHEET_EXPANDED = "expanded";

const norm = (s) => String(s || "").toLowerCase();

const byDateDesc = (a, b) => {
  const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return db - da;
};

function getCadeteNombre(cadete) {
  if (!cadete) return "Repartidor pendiente";

  return (
    [cadete.nombre, cadete.apellido].filter(Boolean).join(" ") ||
    cadete.alias ||
    cadete.id ||
    cadete.cadeteId ||
    "Repartidor asignado"
  );
}

function formatStatus(status) {
  const map = {
    pendiente: "Pedido pendiente",
    asignado: "Repartidor asignado",
    en_camino: "Pedido en curso",
    encurso: "Pedido en curso",
    "en curso": "Pedido en curso",

    enviado_local: "Repartidor asignado",
    asignado_online: "Repartidor asignado",
    en_camino_origen: "El repartidor va hacia el origen",
    retirado: "Pedido retirado",
    en_camino_destino: "El repartidor va hacia el destino",

    finalizado: "Pedido finalizado",
    entregado: "Pedido entregado",
    completado: "Pedido completado",
    cancelado: "Pedido cancelado",
  };

  return map[norm(status)] || "Pedido en curso";
}



function getNextSheetMode(currentMode, direction) {
  if (direction === "up") {
    if (currentMode === SHEET_COLLAPSED) return SHEET_PEEK;
    if (currentMode === SHEET_PEEK) return SHEET_EXPANDED;
    return SHEET_EXPANDED;
  }

  if (direction === "down") {
    if (currentMode === SHEET_EXPANDED) return SHEET_PEEK;
    if (currentMode === SHEET_PEEK) return SHEET_COLLAPSED;
    return SHEET_COLLAPSED;
  }

  return currentMode;
}

export default function ActiveOrderSheet() {
  const navigate = useNavigate();

  const [activeOrders, setActiveOrders] = useState([]);
  const [sheetMode, setSheetMode] = useState(SHEET_PEEK);

  const dragRef = useRef({
    startY: 0,
    currentY: 0,
    dragging: false,
  });

  useEffect(() => {
    loadActiveOrdersDb().then(setActiveOrders);
  }, []);

  // Pedido principal a mostrar: el más reciente
  const activeOrder = activeOrders.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))[0] ?? null;

  const cadete = activeOrder?.assignment?.assignedDriver || activeOrder?.assignedCadete || null;
  const nombreCadete = getCadeteNombre(cadete);

  const hasActiveOrder = Boolean(activeOrder);
  const hasAssignedCadete = Boolean(cadete);

  const goTracking = () => {
    if (!activeOrder) {
      navigate("/orders");
      return;
    }
    const orderId = activeOrder.orderId || activeOrder.id;
    navigate(`/flow/checkout?orderId=${orderId}`);
  };

  const handlePointerDown = (event) => {
    dragRef.current = {
      startY: event.clientY,
      currentY: event.clientY,
      dragging: true,
    };
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.dragging) return;

    dragRef.current.currentY = event.clientY;
  };

  const handlePointerUp = () => {
    if (!dragRef.current.dragging) return;

    const diff = dragRef.current.currentY - dragRef.current.startY;
    const threshold = 28;

    if (diff < -threshold) {
      setSheetMode((current) => getNextSheetMode(current, "up"));
    }

    if (diff > threshold) {
      setSheetMode((current) => getNextSheetMode(current, "down"));
    }

    dragRef.current.dragging = false;
  };

  const handleSheetTap = () => {
    if (sheetMode === SHEET_COLLAPSED) {
      setSheetMode(SHEET_PEEK);
    }
  };

  const toggleExpanded = () => {
    setSheetMode((current) =>
      current === SHEET_EXPANDED ? SHEET_PEEK : SHEET_EXPANDED
    );
  };

  return (
    <section
      className={`${styles.sheet} ${
        hasActiveOrder ? styles.sheetActive : styles.sheetIdle
      } ${styles[sheetMode]}`}
      aria-label="Seguimiento de pedido"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleSheetTap}
    >
      <div className={styles.handle} />

      <div className={styles.collapsedBar}>
        <div className={styles.collapsedInfo}>
          <span
            className={`${styles.statusDot} ${
              hasActiveOrder ? styles.statusDotActive : styles.statusDotIdle
            }`}
            aria-hidden="true"
          />
          <strong>
            {hasActiveOrder ? "Pedido activo" : "Sin pedidos en curso"}
          </strong>
        </div>

        <span className={styles.collapsedHint}>
          {hasActiveOrder ? "Deslizá para ver" : "Seguimiento"}
        </span>
      </div>

      {!hasActiveOrder ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <span />
          </div>

          <div className={styles.emptyText}>
            <strong>Sin pedidos en curso</strong>
            <span>
              Cuando realices un envío, vas a poder seguir su estado desde acá.
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.activeContent}>
          <div className={styles.statusHeader}>
            <div>
              <span className={styles.kicker}>Seguimiento</span>
              <h2>{formatStatus(activeOrder?.status)}</h2>
            </div>

            <button
              type="button"
              className={styles.liveBadge}
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded();
              }}
            >
              {sheetMode === SHEET_EXPANDED ? "Ocultar" : "Activo"}
            </button>
          </div>

          <div className={styles.progressLine}>
            <div
              className={`${styles.progressStep} ${styles.progressStepDone}`}
            >
              <span />
              <strong>Pedido</strong>
            </div>

            <div
              className={`${styles.progressStep} ${
                hasAssignedCadete ? styles.progressStepDone : ""
              }`}
            >
              <span />
              <strong>Asignado</strong>
            </div>

            <div
              className={`${styles.progressStep} ${
                ["retirado", "en_camino_destino", "finalizado"].includes(
                  norm(activeOrder?.status)
                )
                  ? styles.progressStepDone
                  : ""
              }`}
            >
              <span />
              <strong>Retiro</strong>
            </div>

            <div
              className={`${styles.progressStep} ${
                ["finalizado", "entregado", "completado"].includes(
                  norm(activeOrder?.status)
                )
                  ? styles.progressStepDone
                  : ""
              }`}
            >
              <span />
              <strong>Entrega</strong>
            </div>
          </div>

          <div className={styles.cadeteCard}>
            <div className={styles.avatar}>
              {nombreCadete.charAt(0).toUpperCase()}
            </div>

            <div className={styles.cadeteInfo}>
              <strong>{nombreCadete}</strong>
              <span>
                {cadete?.movilidad || "Movilidad no informada"}
                {cadete?.sucursal ? ` · ${cadete.sucursal}` : ""}
              </span>
            </div>

            <div className={styles.cadeteBadge}>
              {cadete?.tipoListado === "online" ? "Online" : "Local"}
            </div>
          </div>

          <div className={styles.expandedOnly}>
            <div className={styles.orderInfo}>
              <div>
                <span>Origen</span>
                <strong>
                  {activeOrder?.originInput ||
                    activeOrder?.origin ||
                    "Origen no informado"}
                </strong>
              </div>

              <div>
                <span>Destino</span>
                <strong>
                  {activeOrder?.destinationInput ||
                    activeOrder?.destination ||
                    "Destino no informado"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={(event) => {
                event.stopPropagation();
                goTracking();
              }}
            >
              Ver seguimiento
            </button>
          </div>
        </div>
      )}
    </section>
  );
}