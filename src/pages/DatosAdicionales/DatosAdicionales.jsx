import React, { useEffect, useMemo, useState } from "react";
import { useFlow } from "../../state/FlowContext";
import { useNavigate } from "react-router-dom";
import styles from "./DatosAdicionales.module.css";

import { auth, db } from "../../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
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

export default function DatosAdicionales() {
  const {
    state,

    // compat
    setNotes,
    setContact,

    // setters nuevos
    setNotesFrom,
    setNotesTo,
    setContactTo,
    setDropoffApt,
    setRecipientName,
    setRecipientPhone,

    buildOrder,
    saveOrder,
  } = useFlow();

  const navigate = useNavigate();

  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");

  const [origenNombre, setOrigenNombre] = useState("");
  const [origenTelefono, setOrigenTelefono] = useState("");

  const [destNombre, setDestNombre] = useState(state.recipientName || "");
  const [destTelefono, setDestTelefono] = useState(state.recipientPhone || "");
  const [destPisoDpto, setDestPisoDpto] = useState(state.dropoffApt || "");
  const [notaOrigen, setNotaOrigen] = useState(state.notesFrom || "");
  const [notaDestino, setNotaDestino] = useState(state.notesTo || "");

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("SessionUser");
      const u = raw ? JSON.parse(raw) : null;

      const nombre =
        [u?.nombre, u?.apellido].filter(Boolean).join(" ") ||
        u?.username ||
        "Usuario";

      const telefono = u?.telefono || "";

      setUserName(nombre);
      setUserPhone(telefono);

      setOrigenNombre((prev) => prev || nombre);
      setOrigenTelefono((prev) => prev || telefono);
    } catch {
      setUserName("Usuario");
      setUserPhone("");
      setOrigenNombre((prev) => prev || "Usuario");
      setOrigenTelefono((prev) => prev || "");
    }
  }, []);

  const precio = useMemo(() => {
    if (state.price && Number(state.price) > 0) return Number(state.price);

    if (state.quote?.total && Number(state.quote.total) > 0) {
      return Number(state.quote.total);
    }

    return Math.round((Number(state.km) || 0) * 1000);
  }, [state.price, state.quote, state.km]);

  const serviceLabel = formatService(state.serviceType);

  const canSubmit =
    !submitting &&
    Boolean(state.origin) &&
    Boolean(state.destination) &&
    Boolean(origenNombre.trim()) &&
    Boolean(onlyDigits(origenTelefono)) &&
    Boolean(destNombre.trim()) &&
    Boolean(onlyDigits(destTelefono));

  const validate = () => {
    if (!state.origin) return "Falta la dirección de origen.";
    if (!state.destination) return "Falta la dirección de destino.";

    if (!origenNombre.trim()) {
      return "Indicá quién entregará el pedido en origen.";
    }

    if (!onlyDigits(origenTelefono)) {
      return "Indicá un teléfono de contacto en origen.";
    }

    if (onlyDigits(origenTelefono).length < 6) {
      return "El teléfono de origen parece incompleto.";
    }

    if (!destNombre.trim()) {
      return "Indicá quién recibirá en destino.";
    }

    if (!onlyDigits(destTelefono)) {
      return "Indicá un teléfono de contacto en destino.";
    }

    if (onlyDigits(destTelefono).length < 6) {
      return "El teléfono de destino parece incompleto.";
    }

    return "";
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

    const recipientName = destNombre.trim();
    const recipientPhone = onlyDigits(destTelefono);
    const floor = destPisoDpto.trim();

    const noteFrom = notaOrigen.trim();
    const noteTo = notaDestino.trim();

    setLocalError("");

    // Persistimos en context antes de construir la orden
    setRecipientName?.(recipientName);
    setRecipientPhone?.(recipientPhone);
    setContactTo?.(recipientPhone);
    setNotesFrom?.(noteFrom);
    setNotesTo?.(noteTo);
    setDropoffApt?.(floor);

    // Compat
    setContact?.(recipientPhone);
    setNotes?.(
      [
        noteFrom ? `ORIGEN: ${noteFrom}` : "",
        noteTo ? `DESTINO: ${noteTo}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    );

    try {
      const su = JSON.parse(localStorage.getItem("SessionUser") || "null");

      let order = buildOrder?.(su) || {};

      order = {
        ...order,

        id: order.id || `ORD-${Date.now()}`,

        version: 1,
        appSource: "customer_app",
        createdBy: "customer_app",

        createdAtLocal: order.createdAtLocal || new Date().toISOString(),

        status: "pendiente",
        serverStatus: "pending_validation",
        assignmentStatus: "unassigned",

        tipoPedido: "online",
        assignmentScope: "online",
        allowsFallbackToLocal:
          typeof order.allowsFallbackToLocal === "boolean"
            ? order.allowsFallbackToLocal
            : true,
        priority: order.priority || "normal",

        customerUid:
          auth.currentUser?.uid || order.customerUid || order.userId || null,
        userId: auth.currentUser?.uid || order.userId || null,

        customerPhone: order.customerPhone || su?.telefono || "",

        price: Number(order.price || 0) > 0 ? Number(order.price) : precio,

        paymentMethod: order.paymentMethod === "digital" ? "digital" : "cash",
        requiresCashHandling: order.paymentMethod === "digital" ? false : true,

        contactFrom: senderPhone,
        contactTo: recipientPhone,

        sender: {
          name: senderName,
          phone: senderPhone,
        },

        dropoffApt: floor,

        recipient: {
          name: recipientName,
          phone: recipientPhone,
          floor,
        },

        notesFrom: noteFrom,
        notesTo: noteTo,

        notes: {
          origen: noteFrom,
          destino: noteTo,
        },

        assignedCadeteId: null,
        assignedCadete: null,
        assignedAt: null,

        serverReviewSummary: null,
      };

      const lockKey = `SUBMIT_${order.id}`;
      if (sessionStorage.getItem(lockKey)) return;

      sessionStorage.setItem(lockKey, "1");
      setSubmitting(true);

      saveOrder?.(order);
      localStorage.setItem("NuevoPedido", JSON.stringify(order));

      const payload = {
        ...order,
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
      };

      await setDoc(doc(db, "orders", String(order.id)), payload, {
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
          <h1 className={styles.title}>Datos adicionales</h1>
          <p className={styles.subtitle}>Completá los contactos del envío.</p>
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

        <section className={styles.card} aria-label="Origen">
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>{pinIcon}</div>

            <div className={styles.cardTitleBlock}>
              <h2 className={styles.cardTitle}>Origen</h2>
              <p className={styles.cardText}>Datos para retirar el pedido.</p>
            </div>
          </div>

          <div className={styles.addressBox}>
            <span className={styles.addressIcon}>{pinIcon}</span>

            <div className={styles.addressText}>
              <span>Dirección de retiro</span>
              <strong>{state.origin || "—"}</strong>
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="origenNombre">
                Nombre de quien entrega
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
                Teléfono de origen
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
            <label className={styles.label} htmlFor="notaOrigen">
              ¿Querés aclarar algo al repartidor?
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

        <section className={styles.card} aria-label="Destino">
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>{destinationIcon}</div>

            <div className={styles.cardTitleBlock}>
              <h2 className={styles.cardTitle}>Destino</h2>
              <p className={styles.cardText}>Datos para entregar el pedido.</p>
            </div>
          </div>

          <div className={styles.addressBox}>
            <span className={styles.addressIcon}>{destinationIcon}</span>

            <div className={styles.addressText}>
              <span>Dirección de entrega</span>
              <strong>{state.destination || "—"}</strong>
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="destNombre">
                ¿Quién recibirá?
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
                Teléfono de contacto
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
              Piso / Dpto / referencia interna
            </label>
            <input
              id="destPiso"
              className={styles.input}
              type="text"
              placeholder="Ej: 7 B, local 3, casa del fondo"
              value={destPisoDpto}
              onChange={(e) => setDestPisoDpto(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="notaDestino">
              ¿Aclaraciones para el repartidor?
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
      </main>

      <footer className={styles.footer}>
        <div className={styles.priceWrap}>
          <span className={styles.priceLabel}>Precio</span>
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
    width="19"
    height="19"
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
    width="19"
    height="19"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);