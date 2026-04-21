// src/components/ActiveOrderSheet/ActiveOrderSheet.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadHistorial,
  loadActual,
} from "../../lib/pedidosStore";
import styles from "./ActiveOrderSheet.module.css";

const norm = (s) => String(s || "").toLowerCase();

const byDateDesc = (a, b) => {
  const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return db - da;
};

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

function getActiveOrder(actual, historial) {
  const activeStatuses = new Set([
    "pendiente",
    "asignado",
    "en_camino",
    "en curso",
    "encurso",
    "enviado_local",
    "asignado_online",
    "en_camino_origen",
    "retirado",
    "en_camino_destino",
  ]);

  const list = [
    actual,
    ...(Array.isArray(historial) ? historial : []),
  ].filter(Boolean);

  return list
    .filter((pedido) => activeStatuses.has(norm(pedido?.status)))
    .sort(byDateDesc)[0] || null;
}

export default function ActiveOrderSheet() {
  const navigate = useNavigate();

  const [actual, setActual] = useState(null);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    setActual(loadActual());
    setHistorial(loadHistorial());
  }, []);

  const activeOrder = useMemo(() => {
    return getActiveOrder(actual, historial);
  }, [actual, historial]);

  const cadete = activeOrder?.assignedCadete || null;
  const nombreCadete = getCadeteNombre(cadete);

  const goTracking = () => {
    if (!activeOrder) {
      navigate("/mis-pedidos");
      return;
    }

    /**
     * Por ahora lo mandamos a Mis Pedidos o al checkout si es el actual.
     * Cuando tengas una ruta real de tracking, por ejemplo:
     * /tracking/:id
     * cambiamos esto por:
     * navigate(`/tracking/${activeOrder.id}`);
     */
    if (activeOrder?.id === actual?.id) {
      navigate("/flow/checkout");
      return;
    }

    navigate("/mis-pedidos");
  };

  if (!activeOrder) {
    return (
      <section className={styles.sheet} aria-label="Pedido en curso">
        <div className={styles.handle} />

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
      </section>
    );
  }

  return (
    <section className={styles.sheet} aria-label="Pedido en curso">
      <div className={styles.handle} />

      <div className={styles.statusHeader}>
        <div>
          <span className={styles.kicker}>Pedido en curso</span>
          <h2>{formatStatus(activeOrder?.status)}</h2>
        </div>

        <span className={styles.liveBadge}>
          Activo
        </span>
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
        onClick={goTracking}
      >
        Ver seguimiento
      </button>
    </section>
  );
}