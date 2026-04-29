// src/pages/DatosAdicionales/DatosAdicionales.jsx
import React, { useEffect, useState } from "react";
import { useFlow } from "../../state/FlowContext";
import { useNavigate } from "react-router-dom";
import styles from "./DatosAdicionales.module.css";

import { auth, db } from "../../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("SessionUser");
      const u = raw ? JSON.parse(raw) : null;
      setUserName(
        [u?.nombre, u?.apellido].filter(Boolean).join(" ") ||
          u?.username ||
          "Usuario"
      );
      setUserPhone(u?.telefono || "");
    } catch {
      setUserName("Usuario");
      setUserPhone("");
    }
  }, []);

  const [destNombre, setDestNombre] = useState(state.recipientName || "");
  const [destTelefono, setDestTelefono] = useState(state.recipientPhone || "");
  const [destPisoDpto, setDestPisoDpto] = useState(state.dropoffApt || "");
  const [notaOrigen, setNotaOrigen] = useState(state.notesFrom || "");
  const [notaDestino, setNotaDestino] = useState(state.notesTo || "");

  const IAddr = (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={styles.icon}>
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c-0 5.65-6 10-6 10z"/>
      <circle cx="12" cy="11" r="2.2" fill="currentColor"/>
    </svg>
  );

  const IUser = (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={styles.icon}>
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M6 20a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );

  const IPhone = (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={styles.icon}>
      <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.1 1.9h2a2 2 0 0 1 2 1.72 12.66 12.66 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.1 9.9a16 16 0 0 0 6 6l1.36-1.26a2 2 0 0 1 2.11-.45 12.66 12.66 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );

  const IFloor = (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={styles.icon}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 3v18M16 3v18M3 8h18M3 16h18" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );

  const INote = (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={styles.icon}>
      <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 4v4h4" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );

  const precio =
    state.price && Number(state.price) > 0
      ? Number(state.price)
      : Math.round((Number(state.km) || 0) * 1000);

  const handleSolicitar = async () => {
    if (submitting) return;

    if (!state.origin) return alert("Falta la dirección de origen.");
    if (!state.destination) return alert("Falta la dirección de destino.");
    if (!destNombre.trim()) return alert("Indicá quién recibirá en destino.");
    if (!destTelefono.trim()) return alert("Indicá un teléfono de contacto en destino.");

    // Persistimos en context antes de construir la orden
    setRecipientName?.(destNombre.trim());
    setRecipientPhone?.(destTelefono.trim());
    setContactTo?.(destTelefono.trim());
    setNotesFrom?.(notaOrigen.trim());
    setNotesTo?.(notaDestino.trim());
    setDropoffApt?.(destPisoDpto.trim());

    // Compat
    setContact?.(destTelefono.trim());
    setNotes?.(
      [
        notaOrigen ? `ORIGEN: ${notaOrigen}` : "",
        notaDestino ? `DESTINO: ${notaDestino}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    );

    try {
      const su = JSON.parse(localStorage.getItem("SessionUser") || "null");

      let order = buildOrder?.(su) || {};

      // Reforzamos el contrato profesional del pedido
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

        customerUid: auth.currentUser?.uid || order.customerUid || order.userId || null,
        userId: auth.currentUser?.uid || order.userId || null,
        customerPhone: order.customerPhone || su?.telefono || "",

        price: Number(order.price || 0) > 0 ? Number(order.price) : precio,

        paymentMethod:
          order.paymentMethod === "digital" ? "digital" : "cash",
        requiresCashHandling:
          order.paymentMethod === "digital" ? false : true,

        contactFrom: order.contactFrom || su?.telefono || "",
        contactTo: destTelefono.trim(),

        dropoffApt: destPisoDpto.trim(),

        recipient: {
          name: destNombre.trim(),
          phone: destTelefono.trim(),
          floor: destPisoDpto.trim(),
        },

        notesFrom: (notaOrigen || "").trim(),
        notesTo: (notaDestino || "").trim(),

        notes: {
          origen: (notaOrigen || "").trim(),
          destino: (notaDestino || "").trim(),
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
      alert("No se pudo crear el pedido. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Datos adicionales</h1>
        {state.serviceType && (
          <span className={styles.badge}>
            {state.serviceType.toUpperCase()}
          </span>
        )}
      </header>

      <main className={styles.main}>
        <section className={styles.card} aria-label="Origen">
          <h2 className={styles.cardTitle}>Origen</h2>

          <div className={`${styles.row} ${styles.rowIcon}`}>
            <span className={styles.rowIco}>{IAddr}</span>
            <label className={styles.key}>Dirección</label>
            <div className={styles.val}>{state.origin || "—"}</div>
          </div>

          <div className={styles.row2col}>
            <div className={styles.col}>
              <div className={`${styles.subrow} ${styles.rowIcon}`}>
                <span className={styles.rowIco}>{IUser}</span>
                <label className={styles.key}>Nombre</label>
              </div>
              <div className={styles.val}>{userName || "—"}</div>
            </div>

            <div className={styles.col}>
              <div className={`${styles.subrow} ${styles.rowIcon}`}>
                <span className={styles.rowIco}>{IPhone}</span>
                <label className={styles.key}>Teléfono</label>
              </div>
              <div className={styles.val}>{userPhone || "—"}</div>
            </div>
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.rowIcon}`}>
              <span className={styles.rowIco}>{INote}</span>
              ¿Querés aclarar algo al repartidor?
            </label>
            <textarea
              className={styles.textarea}
              placeholder="Ej: Timbre roto, portería de 8 a 12..."
              value={notaOrigen}
              onChange={(e) => setNotaOrigen(e.target.value)}
              rows={2}
              maxLength={160}
            />
          </div>
        </section>

        <section className={styles.card} aria-label="Destino">
          <h2 className={styles.cardTitle}>Destino</h2>

          <div className={`${styles.row} ${styles.rowIcon}`}>
            <span className={styles.rowIco}>{IAddr}</span>
            <label className={styles.key}>Dirección</label>
            <div className={styles.val}>{state.destination || "—"}</div>
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.rowIcon}`} htmlFor="destNombre">
              <span className={styles.rowIco}>{IUser}</span>
              ¿Quién recibirá?
            </label>
            <input
              id="destNombre"
              className={styles.input}
              type="text"
              placeholder="Nombre y apellido"
              value={destNombre}
              onChange={(e) => setDestNombre(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.rowIcon}`} htmlFor="destTel">
              <span className={styles.rowIco}>{IPhone}</span>
              Teléfono de contacto
            </label>
            <input
              id="destTel"
              className={styles.input}
              type="tel"
              placeholder="Ej: 11 2345 6789"
              value={destTelefono}
              onChange={(e) => setDestTelefono(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.rowIcon}`} htmlFor="destPiso">
              <span className={styles.rowIco}>{IFloor}</span>
              Piso / Dpto (opcional)
            </label>
            <input
              id="destPiso"
              className={styles.input}
              type="text"
              placeholder="Ej: 7 B"
              value={destPisoDpto}
              onChange={(e) => setDestPisoDpto(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.rowIcon}`}>
              <span className={styles.rowIco}>{INote}</span>
              ¿Aclaraciones para el repartidor?
            </label>
            <textarea
              className={styles.textarea}
              placeholder="Ej: Dejar en recepción, llamar antes de llegar..."
              value={notaDestino}
              onChange={(e) => setNotaDestino(e.target.value)}
              rows={2}
              maxLength={160}
            />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.priceWrap}>
          <span className={styles.priceLabel}>Precio</span>
          <span className={styles.priceValue}>
            {precio > 0 ? `$${precio.toLocaleString("es-AR")}` : "—"}
          </span>
        </div>

        <button
          className={styles.primaryBtn}
          type="button"
          onClick={handleSolicitar}
          disabled={submitting}
        >
          {submitting ? "Creando pedido…" : "Confirmar pedido"}
        </button>
      </footer>
    </div>
  );
}