
// src/pages/DatosAdicionales/DatosAdicionales.jsx
import React, { useEffect, useState } from "react";
import { useFlow } from "../../state/FlowContext";
import { useNavigate } from "react-router-dom";
import styles from "./DatosAdicionales.module.css";

// 🔥 Firebase
import { auth, db } from "../../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function DatosAdicionales() {
  const {
    state,
    // compat si en algún lugar se siguen usando
    setNotes, setContact,
    // setters nuevos del FlowContext mejorado
    setNotesFrom, setNotesTo, setContactTo, setDropoffApt,
    buildOrder, saveOrder,
  } = useFlow();

  const navigate = useNavigate();

  // User logueado (para mostrar en Origen)
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");

  // UI: loading de submit + error
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("SessionUser");
      const u = raw ? JSON.parse(raw) : null;
      setUserName([u?.nombre, u?.apellido].filter(Boolean).join(" ") || u?.username || "Usuario");
      setUserPhone(u?.telefono || "");
    } catch {}
  }, []);

  // Estados controlados de UI
  const [destNombre, setDestNombre] = useState(state.recipientName || "");
  const [destTelefono, setDestTelefono] = useState(state.recipientPhone || "");
  const [destPisoDpto, setDestPisoDpto] = useState(state.dropoffApt || "");
  const [notaOrigen, setNotaOrigen] = useState(state.notesFrom || "");
  const [notaDestino, setNotaDestino] = useState(state.notesTo || "");

  // Íconos inline
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

  // Precio desde context o fallback km*1000
  const precio =
    state.price && Number(state.price) > 0
      ? Number(state.price)
      : Math.round((Number(state.km) || 0) * 1000);

  const handleSolicitar = async () => {
    if (submitting) return;

    // Validaciones mínimas
    if (!state.origin) return alert("Falta la dirección de origen.");
    if (!state.destination) return alert("Falta la dirección de destino.");
    if (!destNombre.trim()) return alert("Indicá quién recibirá en destino.");
    if (!destTelefono.trim()) return alert("Indicá un teléfono de contacto en destino.");

    // Llevar estos datos al Flow (coherente con buildOrder)
    setContactTo?.(destTelefono.trim());
    setNotesFrom?.(notaOrigen.trim());
    setNotesTo?.(notaDestino.trim());
    setDropoffApt?.(destPisoDpto.trim());

    // Compat si aún hay usos externos
    setContact?.(destTelefono.trim());
    setNotes?.(
      [
        notaOrigen ? `ORIGEN: ${notaOrigen}` : "",
        notaDestino ? `DESTINO: ${notaDestino}` : "",
      ].filter(Boolean).join(" | ")
    );

    try {
      const su = JSON.parse(localStorage.getItem("SessionUser") || "null");

      // Base desde FlowContext
      let order = buildOrder?.(su) || {};

      // Enriquecemos + normalizamos status/id/createdAt
      order = {
        id: order.id || `PED-${Date.now()}`,
        createdAt: order.createdAt || new Date().toISOString(),
        status: "pendiente",
        ...order,
        price: order.price && order.price > 0 ? order.price : precio,
        recipient: {
          name: destNombre.trim(),
          phone: destTelefono.trim(),
          floor: destPisoDpto.trim(),
        },
        notes: {
          origen: (notaOrigen || "").trim(),
          destino: (notaDestino || "").trim(),
        },
      };

      // Idempotencia anti doble submit
      const lockKey = `SUBMIT_${order.id}`;
      if (sessionStorage.getItem(lockKey)) {
        return; // ya en curso
      }
      sessionStorage.setItem(lockKey, "1");
      setSubmitting(true);

      // Guardado local (historial + continuidad)
      saveOrder?.(order);
      localStorage.setItem("NuevoPedido", JSON.stringify(order));

      // 🔥 Crear documento en Firestore: orders/{order.id}
      const uid = auth.currentUser?.uid || order.userId || null;
      const payload = {
        ...order,
         tipoPedido: "local",// agregamos esto momentaneamente para hacer creer que es un pedido lcoal antivo
        customerUid: uid,
        createdAtLocal: order.createdAt || null,
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp(),
      };
      await setDoc(doc(db, "orders", String(order.id)), payload, { merge: false });

      // Navegar a pantalla de espera
      navigate("/flow/checkout");
    } catch (e) {
      console.error(e);
      sessionStorage.removeItem(`SUBMIT_${(buildOrder?.() || {}).id || ""}`);
      alert("No se pudo crear el pedido. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Datos adicionales</h1>
        {state.serviceType && <span className={styles.badge}>{state.serviceType.toUpperCase()}</span>}
      </header>

      <main className={styles.main}>
        {/* ORIGEN */}
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

        {/* DESTINO */}
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

      {/* Footer fijo: precio + CTA */}
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
