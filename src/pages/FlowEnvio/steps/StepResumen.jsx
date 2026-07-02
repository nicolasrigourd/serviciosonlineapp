import React, { useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useAuth } from "../../../state/AuthProvider";
import { db } from "../../../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { clienteDb } from "../../../db/clienteDb";
import { calcularAdicionalManejo } from "../../../lib/cashHandling";
import styles from "./StepResumen.module.css";

function fmtARS(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function buildOrderId() {
  const num = Math.floor(10000 + Math.random() * 90000);
  const suf = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ORD-CA-${num}-${suf}`;
}

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function normalizeServiceType(raw) {
  const v = (raw || "").toLowerCase().trim();
  if (v === "envio" || v === "envios" || v === "delivery") return "delivery";
  if (v === "retiro" || v === "retirar" || v === "pickup")  return "pickup";
  if (v === "valores")                                       return "valores";
  if (v === "bigbox" || v === "big_box")                    return "bigbox";
  if (v === "compras" || v === "shopping")                  return "shopping";
  return v || "delivery";
}

const SERVICE_LABELS = {
  delivery: "Envío",
  pickup:   "Retiro",
  valores:  "Valores",
  bigbox:   "Big Box",
  shopping: "Compras",
};

const METHOD_LABELS = { cash: "Efectivo", mercadopago: "MercadoPago" };

export default function StepResumen({ onConfirm }) {
  const { state, saveOrder, resetDraft } = useFlow();
  const { user } = useAuth();

  const [method,     setMethod]     = useState(state.paymentMethod || "");
  const [chargedTo,  setChargedTo]  = useState(state.serviceChargedTo || "remitente");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const isRetiro        = state.operationType === "retiro";
  const isCompras       = state.operationType === "compras";
  const isValores       = state.operationType === "valores";
  const servicePrice    = Number(state.price) || 0;
  const pickupAmt       = state.pickupPaymentRequired ? (Number(state.pickupPaymentAmount) || 0) : 0;
  const cashHandlingFee = calcularAdicionalManejo(pickupAmt, state.cashHandlingFeeConfig);
  // Para valores el precio de StepMapa ya incluye el cargo por transporte declarado
  const serviceTotal    = isValores ? servicePrice : servicePrice + cashHandlingFee;
  const shoppingBudget  = isCompras ? (Number(state.shoppingBudget) || 0) : 0;
  const declaredValue   = isValores ? (Number(state.declaredValue) || 0) : 0;
  const securityPin     = isValores ? (state.securityPin || "") : "";
  const canConfirm      = !!method && !submitting;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError("");

    try {
      const orderId = buildOrderId();
      const nowMs   = Date.now();
      const now     = new Date();
      const yyyy    = now.getFullYear();
      const mm      = String(now.getMonth() + 1).padStart(2, "0");
      const dd      = String(now.getDate()).padStart(2, "0");

      // Contactos — split nombre completo en firstName/lastName
      const pickupFullName    = state.contactFromName || "";
      const recipientFullName = state.recipientName   || "";
      const { firstName: pickupFirst, lastName: pickupLast }       = splitName(pickupFullName);
      const { firstName: recipientFirst, lastName: recipientLast } = splitName(recipientFullName);

      // Tipo de servicio normalizado (envio → delivery)
      const rawOp        = state.operationType || "envio";
      const serviceType  = normalizeServiceType(rawOp);
      const serviceLabel = SERVICE_LABELS[serviceType] || "Envío";
      const modifierKey  = state.serviceType || rawOp;

      // Ruta
      const distanceKm     = Number(state.km)          || 0;
      const distanceMeters = Math.round(distanceKm * 1000);
      const durationMin    = Number(state.durationMin)  || 0;
      const durationSec    = Number(state.durationSec)  || 0;

      // Adelanto en origen
      const requiresMoney = pickupAmt > 0;
      const isDigital    = method === "mercadopago";

      // Usuario creador
      const createdByUser = [user?.nombre, user?.apellido].filter(Boolean).join(" ")
        || user?.username || "";

      const order = {
        version:  3,
        orderId,

        orderType:         "online",
        status:            "pending",
        assignmentScope:   "online",
        assignmentManager: "server",
        assignmentStatus:  "unassigned",
        assignedDriverId:  null,

        createdFrom:    "customer_app",
        createdByUser,
        customerUid:    user?.uid || null,

        createdAt:   serverTimestamp(),
        createdAtMs: nowMs,
        updatedAt:   serverTimestamp(),
        updatedAtMs: nowMs,

        dateKey:  `${yyyy}-${mm}-${dd}`,
        monthKey: `${yyyy}-${mm}`,

        created: {
          from: "customer_app",
          by: {
            id:   user?.uid || null,
            user: createdByUser,
            type: "customer",
          },
        },

        clientType: "regular",

        assignment: {
          scope:            "online",
          manager:          "server",
          status:           "unassigned",
          mode:             null,
          source:           null,
          assignedDriverId: null,
          assignedDriver:   null,
          assignedAt:       null,
          assignedAtMs:     null,
          confirmedBy:      null,
          confirmedAt:      null,
          blocksAppOffer:   false,
        },

        customer: {
          name:  createdByUser,
          phone: user?.telefono || "",
          uid:   user?.uid || null,
        },

        pickup: {
          address:      state.origin || "",
          input:        state.origin || "",
          mode:         "address",
          barrioId:     null,
          barrioNombre: null,
          coords:       state.originCoords || { lat: null, lng: null },
          contact: {
            firstName: isCompras ? (state.storeName || "") : pickupFirst,
            lastName:  isCompras ? "" : pickupLast,
            fullName:  isCompras ? (state.storeName || "") : pickupFullName,
            phone:     isCompras ? "" : (state.contactFrom || ""),
          },
          floor:      state.pickupFloor     || "",
          apartment:  state.pickupApartment || "",
          reference:  state.pickupReference || "",
          notes:      state.notesFrom       || "",
        },

        dropoff: {
          address:      state.destination || "",
          input:        state.destination || "",
          mode:         "address",
          barrioId:     null,
          barrioNombre: null,
          coords:       state.destinationCoords || { lat: null, lng: null },
          contact: {
            firstName: recipientFirst,
            lastName:  recipientLast,
            fullName:  recipientFullName,
            phone:     state.recipientPhone || "",
          },
          floor:      state.dropoffFloor     || "",
          apartment:  state.dropoffApartment || "",
          reference:  state.dropoffReference || "",
          notes:      state.notesTo          || "",
        },

        recipient: {
          name:  recipientFullName,
          phone: state.recipientPhone || "",
        },

        service: {
          type:              serviceType,
          label:             serviceLabel,
          category:          state.serviceCategory || "",
          modifierKey,
          requiresMoney:     isCompras ? true : requiresMoney,
          transportsCash:    isValores ? true : false,
          driverPaysUpfront: isCompras ? true : requiresMoney,
          hideTracking:      isValores ? true : false,
          requiresPin:       isValores ? true : false,
        },

        description: "",

        route: {
          provider:          "google_directions",
          profile:           "driving",
          distanceKm,
          distanceMeters,
          durationMin,
          durationSeconds:   durationSec,
          geometrySource:    "google",
          calculationMethod: "distance_real",
          calculatedAtMs:    nowMs,
        },

        productList: isCompras ? (state.shoppingList || []) : [],

        declaredValue: isValores ? declaredValue : 0,

        deliveryConfirmation: {
          method: isValores ? "pin" : "none",
          pin:    isValores ? securityPin : null,
        },

        driverRequirements: {
          requiresCashHandling: isCompras ? true : requiresMoney,
          allowedMobilities:    [],
          requiresApp:          true,
          minimumLevel:         1,
          noActiveStrikes:      false,
        },

        orderTypeSnapshot: {
          id:                   rawOp,
          name:                 serviceLabel,
          money:                null,
          deliveryConfirmation: { method: "none" },
          engineConfig:         null,
        },

        pricing: {
          price:                 serviceTotal,
          basePrice:             servicePrice,
          pickupPaymentRequired: state.pickupPaymentRequired || false,
          pickupPaymentAmount:   pickupAmt,
          cashHandlingFee:       isValores ? 0 : cashHandlingFee,
          currency:              "ARS",
          surcharge:             state.surcharge || 0,
          pending:               false,
          breakdown:             null,
        },

        payment: {
          serviceChargedTo:     chargedTo,
          method:               isDigital ? "digital" : method,
          provider:             isDigital ? "mercadopago" : null,
          label:                METHOD_LABELS[method] || "",
          status:               "pending",
          requiresCashHandling: isDigital ? false : (isCompras ? true : requiresMoney),
          requiresMoney:        isCompras ? true : requiresMoney,
          requiredMoneyAmount:  isCompras ? shoppingBudget : pickupAmt,
          transportsCash:       false,
          driverPaysUpfront:    isCompras ? true : requiresMoney,
          cashDirection:        isCompras ? "none" : (requiresMoney ? "driver_pays_pickup" : "none"),
          cashAmount:           isCompras ? 0 : pickupAmt,
          cashHandlingFee:      isCompras ? 0 : cashHandlingFee,
        },

        offer: {
          driverId:       null,
          status:         null,
          state:          null,
          attempt:        0,
          offeredAt:      null,
          offeredAtMs:    null,
          expiresAt:      null,
          expiresAtMs:    null,
          respondedAt:    null,
          respondedAtMs:  null,
          closedAt:       null,
          closedAtMs:     null,
          closeReason:    "",
          responseSource: "",
        },

        delivery: {
          currentStep:       null,
          operationalStatus: null,
          startedPickupAt:   null,
          arrivedPickupAt:   null,
          pickedUpAt:        null,
          arrivedDropoffAt:  null,
          finishedAt:        null,
          finishedAtMs:      null,
        },

        engine: {
          status:         "pending_engine",
          lastResult:     null,
          lastAttemptAt:  null,
          lastMatchType:  null,
          lastEvaluation: null,
        },

        server: {
          status:        null,
          reviewAt:      null,
          reviewSummary: null,
        },

        cancellation: {
          cancelledAt:   null,
          cancelledAtMs: null,
          reason:        "",
        },

        rating: {
          value:   null,
          ratedAt: null,
        },
      };

      saveOrder(order);
      await setDoc(doc(db, "orders", orderId), order, { merge: false });

      resetDraft();
      onConfirm?.(orderId);
    } catch (e) {
      console.error("[RESUMEN] Error al confirmar:", e);
      setError("No pudimos crear el pedido. Intentá nuevamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.step}>
      <div className={styles.content}>

        {/* ── Ruta ─────────────────────────────────────── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Recorrido</p>
          <div className={styles.route}>
            <div className={styles.routeRow}>
              <span className={`${styles.routeDot} ${styles.dotFrom}`} />
              <span className={styles.routeAddr}>{state.origin || "—"}</span>
            </div>
            <div className={styles.routeLine} />
            <div className={styles.routeRow}>
              <span className={`${styles.routeDot} ${styles.dotTo}`} />
              <span className={styles.routeAddr}>{state.destination || "—"}</span>
            </div>
          </div>
          {state.km ? <p className={styles.routeMeta}>{state.km} km</p> : null}
        </div>

        {/* ── PIN de seguridad (solo isValores) ─────────── */}
        {isValores && securityPin && (
          <div className={styles.pinCard}>
            <div className={styles.pinCardHeader}>
              {pinCardIcon}
              <span>PIN de entrega</span>
            </div>
            <div className={styles.pinDigits}>
              {securityPin.split("").map((d, i) => (
                <span key={i} className={styles.pinDigit}>{d}</span>
              ))}
            </div>
            <p className={styles.pinNote}>
              Compartí este PIN con quien va a recibir el dinero. El repartidor lo ingresa al hacer la entrega.
            </p>
          </div>
        )}

        {/* ── Monto declarado (solo isValores) ──────────── */}
        {isValores && declaredValue > 0 && (
          <div className={styles.advanceBlock}>
            <div className={styles.payLine}>
              <span className={styles.advanceLabel}>Monto a transportar</span>
              <strong>{fmtARS(declaredValue)}</strong>
            </div>
            <p className={styles.advanceNote}>
              El repartidor verificará este monto antes de retirarlo.
            </p>
          </div>
        )}

        {/* ── Aviso sin tracking (solo isValores) ───────── */}
        {isValores && (
          <div className={styles.trackingNotice}>
            {shieldNoticeIcon}
            <div>
              <strong>Ruta protegida</strong>
              <p>Por seguridad, no verás la ubicación del repartidor durante el trayecto. Recibirás actualizaciones de estado.</p>
            </div>
          </div>
        )}

        {/* ── Lista de compras (solo isCompras) ────────── */}
        {isCompras && (state.shoppingList || []).length > 0 && (
          <div className={styles.card}>
            <p className={styles.cardTitle}>Lista de compras</p>
            <ul className={styles.shoppingList}>
              {(state.shoppingList || []).map((item, i) => (
                <li key={i} className={styles.shoppingItem}>🛒 {item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Contactos ────────────────────────────────── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Contactos</p>
          <div className={styles.contactRow}>
            <div className={styles.contactItem}>
              <span className={styles.contactLabel}>
                {isCompras ? "Compra en" : isRetiro ? "Retira en" : "Entrega"}
              </span>
              <strong>{isCompras ? (state.storeName || "—") : (state.contactFromName || "—")}</strong>
              <span>{isCompras ? "" : (state.contactFrom || "")}</span>
            </div>
            <div className={styles.sep} />
            <div className={styles.contactItem}>
              <span className={styles.contactLabel}>{isRetiro ? "Entrega en" : "Recibe"}</span>
              <strong>{state.recipientName || "—"}</strong>
              <span>{state.recipientPhone || ""}</span>
            </div>
          </div>
        </div>

        {/* ── Pago ─────────────────────────────────────── */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Pago</p>

          {/* Costo del servicio */}
          <div className={styles.payLines}>
            <div className={styles.payLine}>
              <span>Servicio</span>
              <strong>{fmtARS(servicePrice)}</strong>
            </div>
            {cashHandlingFee > 0 && (
              <div className={styles.payLine}>
                <span>Manejo de efectivo</span>
                <strong>+{fmtARS(cashHandlingFee)}</strong>
              </div>
            )}
            <div className={`${styles.payLine} ${styles.payLineTotal}`}>
              <span>Total servicio</span>
              <strong>{fmtARS(serviceTotal)}</strong>
            </div>
          </div>

          {/* Adelanto del repartidor — flujo envio/retiro */}
          {!isCompras && pickupAmt > 0 && (
            <div className={styles.advanceBlock}>
              <div className={styles.payLine}>
                <span className={styles.advanceLabel}>Adelanto del repartidor</span>
                <strong>{fmtARS(pickupAmt)}</strong>
              </div>
              <p className={styles.advanceNote}>
                El repartidor paga esto al retirar y lo recupera en destino.
              </p>
            </div>
          )}

          {/* Presupuesto compras — flujo compras */}
          {isCompras && shoppingBudget > 0 && (
            <div className={styles.advanceBlock}>
              <div className={styles.payLine}>
                <span className={styles.advanceLabel}>Dinero para las compras</span>
                <strong>{fmtARS(shoppingBudget)}</strong>
              </div>
              <p className={styles.advanceNote}>
                El repartidor usará este monto para hacer las compras en el comercio.
              </p>
            </div>
          )}

          {/* Método de pago */}
          <p className={styles.paySubLabel}>¿Cómo vas a pagar?</p>
          <div className={styles.methodRow}>
            <button
              type="button"
              className={`${styles.methodBtn} ${method === "cash" ? styles.methodActive : ""}`}
              onClick={() => setMethod("cash")}
            >
              {cashIcon} <span>Efectivo</span>
            </button>
            <button
              type="button"
              className={`${styles.methodBtn} ${method === "mercadopago" ? styles.methodActive : ""}`}
              onClick={() => setMethod("mercadopago")}
            >
              {mpIcon} <span>MercadoPago</span>
            </button>
          </div>

          {/* Quién paga (toggle discreto) */}
          <div className={styles.chargeToggle}>
            <span className={styles.chargeToggleLabel}>¿Quién abona el servicio?</span>
            <div className={styles.chargeOptions}>
              <button
                type="button"
                className={`${styles.chargeOpt} ${chargedTo === "remitente" ? styles.chargeOptActive : ""}`}
                onClick={() => setChargedTo("remitente")}
              >
                {isRetiro ? "Yo" : "Remitente"}
              </button>
              <button
                type="button"
                className={`${styles.chargeOpt} ${chargedTo === "destinatario" ? styles.chargeOptActive : ""}`}
                onClick={() => setChargedTo("destinatario")}
              >
                {isRetiro ? "Quien envía" : "Destinatario"}
              </button>
            </div>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.confirmBtn}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {submitting ? "Creando pedido…" : "Confirmar pedido"}
          {!submitting && checkIcon}
        </button>
      </div>
    </div>
  );
}

const checkIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

const pinCardIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const shieldNoticeIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
  </svg>
);

const cashIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="6" width="18" height="12" rx="2.5"/>
    <circle cx="12" cy="12" r="2.3"/>
  </svg>
);

const mpIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="5" width="20" height="14" rx="3"/>
    <path d="M2 10h20"/>
  </svg>
);
