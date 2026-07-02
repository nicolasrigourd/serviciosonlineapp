import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { clienteDb } from "../../db/clienteDb";
import OrderTrackingModal from "../OrderTrackingModal/OrderTrackingModal";
import styles from "./ActiveOrdersSheet.module.css";

// ─── helpers ────────────────────────────────────────────────
const PRIORITY = { moving: 0, assigned: 1, offering: 2, searching: 3 };

const ACTIVE_STATUSES = new Set([
  "pending", "pendiente",
  "assigned", "asignado",
  "offering", "ofertando", "ofertado",
  "en_camino", "en_camino_origen", "en_camino_destino",
  "en curso", "encurso", "en_curso",
  "enviado_local", "asignado_online",
  "retirado",
]);
const PEEK_H = 76; // height of the handle+peek strip in px

const norm = (s) => String(s || "").toLowerCase().trim();

function getStatusInfo(order) {
  const status = norm(order?.status);
  const step = norm(order?.delivery?.currentStep || "");
  const hasDriver = Boolean(
    order?.assignment?.assignedDriverId || order?.assignedDriverId
  );

  if (status === "pending" || status === "pendiente")
    return { label: "Buscando repartidor", tone: "searching" };
  if (status === "offering" || status === "ofertando")
    return { label: "Oferta enviada", tone: "offering" };
  if (step === "started_pickup")
    return { label: "En camino al origen", tone: "moving" };
  if (step === "arrived_pickup")
    return { label: "En el punto de retiro", tone: "moving" };
  if (step === "go_to_dropoff")
    return { label: "En camino al destino", tone: "moving" };
  if (step === "arrived_dropoff")
    return { label: "Llegó al destino", tone: "moving" };
  if (hasDriver || status === "assigned" || status === "asignado")
    return { label: "Repartidor asignado", tone: "assigned" };

  return { label: "En curso", tone: "searching" };
}

function getDriver(order) {
  const d = order?.assignment?.assignedDriver;
  const hasDriver = Boolean(
    order?.assignment?.assignedDriverId || order?.assignedDriverId || d
  );
  if (!hasDriver) return null;
  return {
    name:
      [d?.firstName, d?.lastName].filter(Boolean).join(" ") ||
      d?.fullName ||
      "Repartidor",
    vehicle: d?.mobility || d?.movilidad || "Moto",
    plate: d?.vehiclePlate || d?.vehicle?.plate || "",
  };
}

function shortId(id) {
  const v = String(id || "");
  return v.length > 8 ? `#${v.slice(-6)}` : `#${v}`;
}

// ─── sub-components ─────────────────────────────────────────

function StatusDot({ tone }) {
  return (
    <span
      className={`${styles.dot} ${styles[`dot_${tone}`]}`}
      aria-hidden="true"
    />
  );
}

function ChevronUp({ flipped }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{
        transform: flipped ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.28s ease",
        display: "block",
      }}
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function ProgressBar({ tone }) {
  return (
    <div className={styles.progressTrack}>
      <div className={`${styles.progressFill} ${styles[`fill_${tone}`]}`} />
    </div>
  );
}

function OrderCard({ order, onOpen }) {
  const id = order.orderId || order.id;
  const { label, tone } = getStatusInfo(order);
  const driver = getDriver(order);

  return (
    <button
      className={styles.card}
      onClick={() => onOpen(id, order)}
      aria-label={`Pedido ${shortId(id)} — ${label}. Ver mapa`}
    >
      <div className={styles.cardMain}>
        {driver ? (
          <div className={styles.driverAvatar}>{driver.name.charAt(0)}</div>
        ) : (
          <StatusDot tone={tone} />
        )}

        <div className={styles.cardText}>
          {driver ? (
            <>
              <span className={styles.driverName}>{driver.name}</span>
              <span className={styles.cardSub}>
                {driver.vehicle}{driver.plate ? ` · ${driver.plate}` : ""}
              </span>
              <span className={styles.cardStatus}>{label}</span>
            </>
          ) : (
            <>
              <span className={styles.cardId}>{shortId(id)}</span>
              <span className={styles.cardStatus}>{label}</span>
            </>
          )}
        </div>

        <span className={styles.cardArrow} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>

      <ProgressBar tone={tone} />
    </button>
  );
}

// ─── main component ──────────────────────────────────────────

export default function ActiveOrdersSheet() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);

  const drag = useRef({ active: false, startY: 0, lastY: 0 });

  // Reactivo a cambios en IndexedDB (sincronizado desde Firestore por syncService)
  const rawOrders = useLiveQuery(() => clienteDb.orders.toArray(), []);
  const orders = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders
      .filter((p) => ACTIVE_STATUSES.has(norm(p.status)))
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [rawOrders]);

  if (orders.length === 0) return null;

  // Pick most-active order for the peek strip
  const primary = [...orders].sort(
    (a, b) =>
      (PRIORITY[getStatusInfo(a).tone] ?? 9) -
      (PRIORITY[getStatusInfo(b).tone] ?? 9)
  )[0];

  const primaryId = primary.orderId || primary.id;
  const { label: primaryLabel, tone: primaryTone } = getStatusInfo(primary);
  const primaryDriver = getDriver(primary);
  const extraCount = orders.length - 1;

  // Sheet height: peek strip (PEEK_H) + list content height, capped at 65dvh
  const LIST_ITEM_H = 86;
  const HEADER_H = 46;
  const VER_H = orders.length >= 5 ? 50 : 0;
  const expandedRaw = PEEK_H + HEADER_H + orders.length * LIST_ITEM_H + VER_H;
  const sheetH = expanded
    ? `min(${expandedRaw}px, 65dvh)`
    : `${PEEK_H}px`;

  const openTracking = (id, order) => {
    setTrackingOrder(order || null);
    setTrackingId(id);
  };

  // Drag handlers (handle zone only)
  const onPointerDown = (e) => {
    drag.current = { active: true, startY: e.clientY, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    drag.current.lastY = e.clientY;
  };
  const onPointerUp = () => {
    if (!drag.current.active) return;
    const delta = drag.current.lastY - drag.current.startY;
    if (delta < -28) setExpanded(true);
    else if (delta > 28) setExpanded(false);
    drag.current.active = false;
  };

  return (
    <>
      <div
        className={styles.sheet}
        style={{ height: sheetH }}
        role="complementary"
        aria-label="Pedidos activos"
      >
        {/* ── Handle zone (peek strip + drag area) ───────────── */}
        <div
          className={styles.handleZone}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => setExpanded((v) => !v)}
        >
          <div className={styles.handle} aria-hidden="true" />

          <div className={styles.peekRow}>
            {primaryDriver ? (
              <div className={styles.avatarSm}>
                {primaryDriver.name.charAt(0)}
              </div>
            ) : (
              <StatusDot tone={primaryTone} />
            )}

            <div className={styles.peekMeta}>
              {primaryDriver ? (
                <>
                  <span className={styles.peekName}>{primaryDriver.name}</span>
                  <span className={styles.peekSub}>
                    {primaryDriver.vehicle}{primaryDriver.plate ? ` · ${primaryDriver.plate}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.peekId}>{shortId(primaryId)}</span>
                  <span className={styles.peekStatus}>{primaryLabel}</span>
                </>
              )}
            </div>

            <div className={styles.peekRight}>
              {extraCount > 0 && (
                <span className={styles.badge}>+{extraCount}</span>
              )}
              <span className={styles.chevron}>
                <ChevronUp flipped={expanded} />
              </span>
            </div>
          </div>

          <ProgressBar tone={primaryTone} />
        </div>

        {/* ── Expanded list ──────────────────────────────────── */}
        <div className={`${styles.listArea} ${expanded ? styles.listVisible : ""}`}>
          <div className={styles.listHeader}>
            <strong>Pedidos activos</strong>
            <span>{orders.length} en curso</span>
          </div>

          {orders.map((order) => (
            <OrderCard
              key={order.orderId || order.id}
              order={order}
              onOpen={openTracking}
            />
          ))}

          {orders.length >= 5 && (
            <button
              className={styles.verTodos}
              onClick={(e) => {
                e.stopPropagation();
                navigate("/orders");
              }}
            >
              Ver todos en Mis Pedidos
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {trackingId && (
        <OrderTrackingModal
          orderId={trackingId}
          initialOrder={trackingOrder}
          onClose={() => {
            setTrackingId(null);
            setTrackingOrder(null);
          }}
        />
      )}
    </>
  );
}
