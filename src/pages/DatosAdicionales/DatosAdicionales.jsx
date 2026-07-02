
import React, { useEffect, useMemo, useState } from "react";
import { useFlow } from "../../state/FlowContext";
import { useNavigate } from "react-router-dom";
import styles from "./DatosAdicionales.module.css";

import mercadoPagoLogo from "../../assets/logomercadop.jpg";

import { auth, db } from "../../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value = "") {
  return String(value ?? "").trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (!number) return "—";
  return `$${number.toLocaleString("es-AR")}`;
}

function formatService(value) {
  const map = {
    simple: "Simple",
    box: "Box",
    bigbox: "BigBox",
    valores: "Valores",
    delivery: "Delivery",
  };

  return map[String(value || "").toLowerCase()] || "Envío";
}

function readOperationType(state) {
  if (state?.operationType === "retiro") return "retiro";
  if (state?.operationType === "envio") return "envio";

  try {
    const stored = sessionStorage.getItem("FLOW_OPERATION_TYPE");
    if (stored === "retiro") return "retiro";
    if (stored === "envio") return "envio";
  } catch {}

  return "envio";
}

function readSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("SessionUser") || "null");
  } catch {
    return null;
  }
}

function getUserDisplayName(user) {
  return (
    [user?.nombre, user?.apellido].filter(Boolean).join(" ") ||
    user?.username ||
    "Usuario"
  );
}

function getUserPhone(user) {
  return user?.telefono || "";
}

function getDefaultAddressExtra(user) {
  const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
  const def = addresses.find((item) => item?.isDefault) || addresses[0] || null;

  return {
    piso: def?.piso || user?.dpto || "",
    referencia: def?.referencia || def?.descripcion || "",
  };
}

function splitName(fullName = "") {
  const clean = normalizeText(fullName);

  if (!clean) {
    return {
      firstName: "",
      lastName: "",
      fullName: "",
    };
  }

  const parts = clean.split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");

  return {
    firstName,
    lastName,
    fullName: clean,
  };
}

function normalizeCoords(coords) {
  if (!coords || typeof coords !== "object") {
    return {
      lat: null,
      lng: null,
      placeId: "",
    };
  }

  const lat = Number(coords.lat);
  const lng = Number(coords.lng);

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    placeId: normalizeText(coords.placeId),
  };
}

function buildOrderId() {
  const number = Math.floor(10000 + Math.random() * 90000);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();

  return `ORD-CA-${number}-${suffix}`;
}

function getDateKeys(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    monthKey: `${yyyy}-${mm}`,
  };
}

function getRouteFromState(state, fallbackOrder = {}) {
  const km = toNumber(
    state.km ||
      state.quote?.km ||
      state.route?.distanceKm ||
      fallbackOrder?.route?.distanceKm,
    0
  );

  const distanceMeters = toNumber(
    state.route?.distanceMeters ||
      state.quote?.distanceMeters ||
      fallbackOrder?.route?.distanceMeters,
    km * 1000
  );

  return {
    distanceKm: km,
    distanceMeters,
    durationMin: toNumber(
      state.route?.durationMin ||
        state.quote?.durationMin ||
        fallbackOrder?.route?.durationMin,
      0
    ),
    durationSeconds: toNumber(
      state.route?.durationSeconds ||
        state.quote?.durationSeconds ||
        fallbackOrder?.route?.durationSeconds,
      0
    ),
    provider: normalizeText(
      state.route?.provider || fallbackOrder?.route?.provider || ""
    ),
    profile: normalizeText(
      state.route?.profile || fallbackOrder?.route?.profile || ""
    ),
    geometrySource: normalizeText(
      state.route?.geometrySource || fallbackOrder?.route?.geometrySource || ""
    ),
    calculatedAtMs: toNumber(
      state.route?.calculatedAtMs ||
        state.quote?.calculatedAtMs ||
        fallbackOrder?.route?.calculatedAtMs,
      Date.now()
    ),
  };
}

const PAYMENT_OPTIONS = {
  cash: {
    value: "cash",
    normalizedMethod: "cash",
    label: "Efectivo",
    subtitle: "El cliente paga al repartidor al finalizar.",
    status: "pending",
    requiresCashHandling: true,
    requiresMercadoPago: false,
    provider: null,
  },
  mercadopago: {
    value: "mercadopago",
    normalizedMethod: "digital",
    label: "MercadoPago",
    subtitle: "Solo repartidores habilitados para MercadoPago.",
    status: "pending",
    requiresCashHandling: false,
    requiresMercadoPago: true,
    provider: "mercadopago",
  },
};

export default function DatosAdicionales() {
  const {
    state,

    // compat
    setContact,

    // setters nuevos
    setNotesFrom,
    setNotesTo,
    setContactFrom,
    setContactFromName,
    setContactTo,
    setDropoffApt,
    setRecipientName,
    setRecipientPhone,
    setPaymentMethod: setPaymentMethodInFlow,
    setPickupApt,

    buildOrder,
    saveOrder,
  } = useFlow();

  const navigate = useNavigate();

  const operationType = readOperationType(state);
  const isRetiro = operationType === "retiro";

  const [origenNombre, setOrigenNombre] = useState("");
  const [origenTelefono, setOrigenTelefono] = useState("");
  const [origenPisoRef, setOrigenPisoRef] = useState(
    state.pickupApt || state.pickupReference || ""
  );

  const [destNombre, setDestNombre] = useState(state.recipientName || "");
  const [destTelefono, setDestTelefono] = useState(
    state.recipientPhone || state.contactTo || ""
  );
  const [destPisoDpto, setDestPisoDpto] = useState(
    state.dropoffApt || state.dropoffReference || ""
  );

  const [notaOrigen, setNotaOrigen] = useState(state.notesFrom || "");
  const [notaDestino, setNotaDestino] = useState(state.notesTo || "");

  const [paymentMethod, setPaymentMethod] = useState(() => {
    if (state.paymentMethod === "cash") return "cash";
    if (state.paymentMethod === "mercadopago") return "mercadopago";
    if (state.paymentMethod === "digital") return "mercadopago";
    return "";
  });

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    const u = readSessionUser();
    const nombre = getUserDisplayName(u);
    const telefono = getUserPhone(u);
    const addressExtra = getDefaultAddressExtra(u);

    if (isRetiro) {
      setOrigenNombre((prev) => prev || state.contactFromName || "");
      setOrigenTelefono((prev) => prev || state.contactFrom || "");

      setOrigenPisoRef((prev) => {
        if (prev) return prev;
        if (state.pickupApt) return state.pickupApt;
        if (state.pickupReference) return state.pickupReference;
        return "";
      });

      setDestNombre((prev) => prev || state.recipientName || nombre);

      setDestTelefono(
        (prev) => prev || state.recipientPhone || state.contactTo || telefono
      );

      setDestPisoDpto((prev) => {
        if (prev) return prev;
        if (state.dropoffApt) return state.dropoffApt;
        if (state.dropoffReference) return state.dropoffReference;
        if (addressExtra.piso) return addressExtra.piso;
        return "";
      });
    } else {
      setOrigenNombre((prev) => prev || state.contactFromName || nombre);
      setOrigenTelefono((prev) => prev || state.contactFrom || telefono);

      setOrigenPisoRef((prev) => {
        if (prev) return prev;
        if (state.pickupApt) return state.pickupApt;
        if (state.pickupReference) return state.pickupReference;
        if (addressExtra.piso) return addressExtra.piso;
        return "";
      });

      setDestNombre((prev) => prev || state.recipientName || "");

      setDestTelefono(
        (prev) => prev || state.recipientPhone || state.contactTo || ""
      );

      setDestPisoDpto((prev) => {
        if (prev) return prev;
        if (state.dropoffApt) return state.dropoffApt;
        if (state.dropoffReference) return state.dropoffReference;
        return "";
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const precio = useMemo(() => {
    if (state.price && Number(state.price) > 0) return Number(state.price);

    if (state.quote?.total && Number(state.quote.total) > 0) {
      return Number(state.quote.total);
    }

    return Math.round((Number(state.km) || 0) * 1000);
  }, [state.price, state.quote, state.km]);

  const serviceLabel = formatService(state.serviceType);

  const selectedPayment = paymentMethod ? PAYMENT_OPTIONS[paymentMethod] : null;

  const canSubmit =
    !submitting &&
    Boolean(state.origin) &&
    Boolean(state.destination) &&
    Boolean(origenNombre.trim()) &&
    Boolean(onlyDigits(origenTelefono)) &&
    Boolean(destNombre.trim()) &&
    Boolean(onlyDigits(destTelefono)) &&
    Boolean(paymentMethod);

  const validate = () => {
    if (!state.origin) return "Falta la dirección de origen.";
    if (!state.destination) return "Falta la dirección de destino.";

    if (!origenNombre.trim()) {
      return "Indicá quién entrega el pedido en el punto de retiro.";
    }

    if (!onlyDigits(origenTelefono)) {
      return "Indicá un teléfono de contacto en el punto de retiro.";
    }

    if (onlyDigits(origenTelefono).length < 6) {
      return "El teléfono del punto de retiro parece incompleto.";
    }

    if (!destNombre.trim()) {
      return "Indicá quién recibe el pedido en el punto de entrega.";
    }

    if (!onlyDigits(destTelefono)) {
      return "Indicá un teléfono de contacto en el punto de entrega.";
    }

    if (onlyDigits(destTelefono).length < 6) {
      return "El teléfono del punto de entrega parece incompleto.";
    }

    if (!paymentMethod) {
      return "Seleccioná una forma de pago para poder asignar correctamente el pedido.";
    }

    const pickupCoords = normalizeCoords(state.originCoords);
    const dropoffCoords = normalizeCoords(state.destinationCoords);

    if (
      !Number.isFinite(pickupCoords.lat) ||
      !Number.isFinite(pickupCoords.lng)
    ) {
      return "Faltan coordenadas válidas del punto de retiro.";
    }

    if (
      !Number.isFinite(dropoffCoords.lat) ||
      !Number.isFinite(dropoffCoords.lng)
    ) {
      return "Faltan coordenadas válidas del punto de entrega.";
    }

    return "";
  };

  const handlePaymentSelect = (method) => {
    setPaymentMethod(method);
    setPaymentMethodInFlow?.(method);
    setLocalError("");
  };

  const handleSolicitar = async () => {
    if (submitting) return;

    const validationError = validate();

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    const senderName = origenNombre.trim();
    const senderPhone = onlyDigits(origenTelefono);
    const pickupFloor = origenPisoRef.trim();

    const recipientName = destNombre.trim();
    const recipientPhone = onlyDigits(destTelefono);
    const dropoffFloor = destPisoDpto.trim();

    const noteFrom = notaOrigen.trim();
    const noteTo = notaDestino.trim();

    const currentPayment = PAYMENT_OPTIONS[paymentMethod];

    setLocalError("");

    setContactFromName?.(senderName);
    setContactFrom?.(senderPhone);
    setRecipientName?.(recipientName);
    setRecipientPhone?.(recipientPhone);
    setContactTo?.(recipientPhone);
    setNotesFrom?.(noteFrom);
    setNotesTo?.(noteTo);
    setDropoffApt?.(dropoffFloor);
    setPickupApt?.(pickupFloor);
    setPaymentMethodInFlow?.(currentPayment.value);

    // Compatibilidad interna del FlowContext actual.
    setContact?.(recipientPhone);

    try {
      const su = readSessionUser();
      const previousOrder = buildOrder?.(su) || {};

      const now = new Date();
      const nowMs = Date.now();
      const { dateKey, monthKey } = getDateKeys(now);

      const orderId =
        previousOrder.orderId ||
        (String(previousOrder.id || "").startsWith("ORD-CA-")
          ? previousOrder.id
          : buildOrderId());

      const finalPrice =
        Number(previousOrder?.pricing?.price || previousOrder?.price || 0) > 0
          ? Number(previousOrder?.pricing?.price || previousOrder?.price)
          : precio;

      const pickupName = splitName(senderName);
      const dropoffName = splitName(recipientName);

      const pickupCoords = normalizeCoords(state.originCoords);
      const dropoffCoords = normalizeCoords(state.destinationCoords);

      const route = getRouteFromState(state, previousOrder);

      const normalizedPaymentMethod =
        currentPayment.normalizedMethod || currentPayment.value;

      const serviceType = normalizeText(
        state.serviceType || previousOrder?.service?.type || "simple"
      );

      const order = {
        orderId,
        version: 3,

        orderType: "online",
        status: "pending",

        assignmentScope: "online",
        assignmentManager: "server",
        assignmentStatus: "unassigned",

        assignedDriverId: null,

        createdFrom: "customer_app",
        createdByUser: getUserDisplayName(su),

        created: {
          from: "customer_app",
          by: {
            id:
              auth.currentUser?.uid ||
              su?.uid ||
              previousOrder?.customerUid ||
              null,
            type: "customer",
            user: getUserDisplayName(su),
          },
        },

        customer: {
          name: getUserDisplayName(su),
          phone: getUserPhone(su) || senderPhone || "",
        },

        recipient: {
          name: recipientName,
          phone: recipientPhone,
        },

        pickup: {
          address: state.origin || "",
          input: state.origin || "",
          coords: pickupCoords,
          contact: {
            firstName: pickupName.firstName,
            lastName: pickupName.lastName,
            fullName: pickupName.fullName,
            phone: senderPhone,
          },
          floor: pickupFloor,
          apartment: "",
          notes: noteFrom,
        },

        dropoff: {
          address: state.destination || "",
          input: state.destination || "",
          coords: dropoffCoords,
          contact: {
            firstName: dropoffName.firstName,
            lastName: dropoffName.lastName,
            fullName: dropoffName.fullName,
            phone: recipientPhone,
          },
          floor: dropoffFloor,
          apartment: "",
          notes: noteTo,
        },

        description:
          operationType === "retiro"
            ? "Retirar y entregar"
            : "Enviar y entregar",

        service: {
          type: serviceType,
          label: formatService(serviceType),
        },

        route,

        pricing: {
          price: finalPrice,
          currency: "ARS",
          surcharge: toNumber(previousOrder?.pricing?.surcharge, 0),
          breakdown:
            previousOrder?.pricing?.breakdown ||
            state.quote?.breakdown ||
            previousOrder?.breakdown ||
            null,
        },

        payment: {
          method: normalizedPaymentMethod,
          label: currentPayment.label,
          status: currentPayment.status,
          amount: finalPrice,
          currency: "ARS",
          provider: currentPayment.provider,
          requiresCashHandling: currentPayment.requiresCashHandling,
          requiresMercadoPago: currentPayment.requiresMercadoPago,
          requiresMoney: false,
          requiredMoneyAmount: 0,
        },

        priority: previousOrder.priority || "normal",
        allowsFallbackToLocal:
          typeof previousOrder.allowsFallbackToLocal === "boolean"
            ? previousOrder.allowsFallbackToLocal
            : true,

        dateKey,
        monthKey,

        customerUid: auth.currentUser?.uid || previousOrder.customerUid || null,
        userId: auth.currentUser?.uid || previousOrder.userId || null,

        operationType,

        createdAt: serverTimestamp(),
        createdAtMs: nowMs,

        updatedAt: serverTimestamp(),
        updatedAtMs: nowMs,

        assignment: {
          scope: "online",
          manager: "server",
          status: "unassigned",

          mode: null,
          source: "customer_app",

          assignedDriverId: null,
          assignedDriver: null,

          assignedAt: null,
          assignedAtMs: null,

          confirmedBy: null,
          confirmedAt: null,
        },

        offer: {
          attempt: 0,
          driverId: null,

          status: null,
          state: null,

          offeredAt: null,
          offeredAtMs: null,

          expiresAt: null,
          expiresAtMs: null,

          respondedAt: null,
          respondedAtMs: null,

          closedAt: null,
          closedAtMs: null,

          closeReason: "",
          responseSource: "",
        },

        delivery: {
          currentStep: null,
          operationalStatus: null,

          startedPickupAt: null,
          arrivedPickupAt: null,
          pickedUpAt: null,
          arrivedDropoffAt: null,

          finishedAt: null,
          finishedAtMs: null,
        },

        server: {
          status: "pending_validation",
          reviewAt: null,
          reviewSummary: null,
        },

        engine: {
          status: null,
          attempts: 0,
          lastResult: null,
          lastAttemptAt: null,
          nextRetryAt: null,
          lastMatchType: null,
          lastEvaluation: null,
          handoffReason: null,
        },

        cancellation: {
          cancelledAt: null,
          cancelledAtMs: null,
          reason: "",
        },

        rating: {
          value: null,
          ratedAt: null,
        },

        source: "customer_app",
      };

      const lockKey = `SUBMIT_${order.orderId}`;
      if (sessionStorage.getItem(lockKey)) return;

      sessionStorage.setItem(lockKey, "1");
      setSubmitting(true);

      console.log("[DATOS_ADICIONALES][ORDER_FINAL_NUEVO]", order);

      saveOrder?.(order);
      localStorage.setItem("NuevoPedido", JSON.stringify(order));

      await setDoc(doc(db, "orders", String(order.orderId)), order, {
        merge: false,
      });

      navigate("/flow/checkout");
    } catch (e) {
      console.error(e);
      setLocalError("No se pudo crear el pedido. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(-1)}
          aria-label="Volver"
        >
          ←
        </button>

        <div className={styles.headerText}>
          <h1 className={styles.title}>
            {isRetiro ? "Completá el retiro" : "Completá el envío"}
          </h1>
          <p className={styles.subtitle}>
            Revisá los datos antes de confirmar.
          </p>
        </div>

        {state.serviceType && (
          <span className={styles.badge}>{serviceLabel}</span>
        )}
      </header>

      <main className={styles.main}>
        {localError && (
          <div className={styles.error} role="alert">
            {localError}
          </div>
        )}

        <section className={styles.flowCard} aria-label="Punto de retiro">
          <div className={styles.sectionTop}>
            <div>
              <p className={styles.stepLabel}>Punto de retiro</p>
              <h2 className={styles.sectionTitle}>¿Dónde se retira?</h2>
            </div>
            <span className={styles.sectionMark}>01</span>
          </div>

          <div className={styles.addressLine}>
            <span className={styles.addressDot}>{pinIcon}</span>
            <strong>{state.origin || "—"}</strong>
          </div>

          <div className={styles.softDivider} />

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="origenNombre">
                Quién entrega
              </label>
              <input
                id="origenNombre"
                className={styles.input}
                type="text"
                placeholder="Nombre y apellido"
                value={origenNombre}
                onChange={(e) => {
                  setOrigenNombre(e.target.value);
                  setLocalError("");
                }}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="origenTel">
                Teléfono
              </label>
              <input
                id="origenTel"
                className={styles.input}
                type="tel"
                inputMode="numeric"
                placeholder="Sin 0 y sin 15"
                value={origenTelefono}
                onChange={(e) => {
                  setOrigenTelefono(e.target.value);
                  setLocalError("");
                }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="origenPisoRef">
              Piso, dpto, local o referencia del retiro
            </label>
            <input
              id="origenPisoRef"
              className={styles.input}
              type="text"
              placeholder="Ej: local 4, piso 2, recepción, casa del fondo"
              value={origenPisoRef}
              onChange={(e) => setOrigenPisoRef(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="notaOrigen">
              Aclaración para retirar
            </label>
            <textarea
              id="notaOrigen"
              className={styles.textarea}
              placeholder="Ej: tocar timbre, retirar en recepción, preguntar por Ana..."
              value={notaOrigen}
              onChange={(e) => setNotaOrigen(e.target.value)}
              rows={2}
              maxLength={160}
            />
            <div className={styles.counter}>{notaOrigen.length}/160</div>
          </div>
        </section>

        <section className={styles.flowCard} aria-label="Punto de entrega">
          <div className={styles.sectionTop}>
            <div>
              <p className={styles.stepLabel}>Punto de entrega</p>
              <h2 className={styles.sectionTitle}>¿Dónde se entrega?</h2>
            </div>
            <span className={styles.sectionMark}>02</span>
          </div>

          <div className={styles.addressLine}>
            <span className={styles.addressDot}>{destinationIcon}</span>
            <strong>{state.destination || "—"}</strong>
          </div>

          <div className={styles.softDivider} />

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="destNombre">
                Quién recibe
              </label>
              <input
                id="destNombre"
                className={styles.input}
                type="text"
                placeholder="Nombre y apellido"
                value={destNombre}
                onChange={(e) => {
                  setDestNombre(e.target.value);
                  setLocalError("");
                }}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="destTel">
                Teléfono
              </label>
              <input
                id="destTel"
                className={styles.input}
                type="tel"
                inputMode="numeric"
                placeholder="Sin 0 y sin 15"
                value={destTelefono}
                onChange={(e) => {
                  setDestTelefono(e.target.value);
                  setLocalError("");
                }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="destPiso">
              {isRetiro
                ? "Piso, dpto o referencia de tu dirección"
                : "Piso, dpto o referencia de entrega"}
            </label>
            <input
              id="destPiso"
              className={styles.input}
              type="text"
              placeholder={
                isRetiro
                  ? "Ej: piso, dpto, casa del fondo o referencia de entrega"
                  : "Ej: 7 B, local 3, casa del fondo"
              }
              value={destPisoDpto}
              onChange={(e) => setDestPisoDpto(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="notaDestino">
              Aclaración para entregar
            </label>
            <textarea
              id="notaDestino"
              className={styles.textarea}
              placeholder="Ej: dejar en recepción, llamar antes de llegar..."
              value={notaDestino}
              onChange={(e) => setNotaDestino(e.target.value)}
              rows={2}
              maxLength={160}
            />
            <div className={styles.counter}>{notaDestino.length}/160</div>
          </div>
        </section>

        <section className={styles.paymentCard} aria-label="Método de pago">
          <div className={styles.sectionTop}>
            <div>
              <p className={styles.stepLabel}>Pago</p>
              <h2 className={styles.sectionTitle}>¿Cómo querés pagar?</h2>
            </div>

            <span
              className={`${styles.paymentState} ${
                selectedPayment ? styles.paymentStateReady : ""
              }`}
            >
              {selectedPayment ? selectedPayment.label : "Pendiente"}
            </span>
          </div>

          <p className={styles.paymentIntro}>
            Seleccioná la forma de pago para habilitar la confirmación del
            pedido.
          </p>

          <div className={styles.paymentOptions}>
            <button
              type="button"
              className={`${styles.paymentOption} ${
                paymentMethod === "cash" ? styles.paymentOptionActive : ""
              }`}
              onClick={() => handlePaymentSelect("cash")}
            >
              <div className={styles.cashIconWrap}>{cashIcon}</div>

              <div className={styles.paymentOptionInfo}>
                <strong>Efectivo</strong>
                <span>El cliente paga al repartidor al finalizar.</span>
              </div>

              <div className={styles.paymentCheck}>
                {paymentMethod === "cash" ? "✓" : ""}
              </div>
            </button>

            <button
              type="button"
              className={`${styles.paymentOption} ${
                paymentMethod === "mercadopago"
                  ? styles.paymentOptionActive
                  : ""
              }`}
              onClick={() => handlePaymentSelect("mercadopago")}
            >
              <div className={styles.mpLogoWrap}>
                <img
                  src={mercadoPagoLogo}
                  alt="MercadoPago"
                  className={styles.mpLogo}
                />
              </div>

              <div className={styles.paymentOptionInfo}>
                <strong>MercadoPago</strong>
                <span>Solo repartidores habilitados para MercadoPago.</span>
              </div>

              <div className={styles.paymentCheck}>
                {paymentMethod === "mercadopago" ? "✓" : ""}
              </div>
            </button>
          </div>

          {!paymentMethod && (
            <p className={styles.paymentWarning}>
              Todavía falta elegir cómo se pagará el envío.
            </p>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.priceWrap}>
          <span className={styles.priceLabel}>Total</span>
          <span className={styles.priceValue}>{formatMoney(precio)}</span>
        </div>

        <button
          className={styles.primaryBtn}
          type="button"
          onClick={handleSolicitar}
          disabled={submitting || !canSubmit}
        >
          {submitting ? "Creando pedido…" : "Confirmar pedido"}
        </button>
      </footer>
    </div>
  );
}

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

const destinationIcon = (
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

const cashIcon = (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.3" />
    <path d="M6.5 9.2h.01M17.5 14.8h.01" />
  </svg>
);