import React, { useEffect, useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useFlowWizard } from "../../../components/FlowWizard/FlowWizard";
import { clienteDb } from "../../../db/clienteDb";
import styles from "./StepContacto.module.css";

function onlyDigits(v) { return String(v || "").replace(/\D/g, ""); }

export default function StepContactoOrigen() {
  const { state, setContactFromName, setContactFrom, setPickupReference, setNotesFrom } = useFlow();
  const { next } = useFlowWizard();

  const [nombre,    setNombre]    = useState(state.contactFromName || "");
  const [telefono,  setTelefono]  = useState(state.contactFrom || "");
  const [referencia,setReferencia]= useState(state.pickupReference || "");
  const [nota,      setNota]      = useState(state.notesFrom || "");

  // Envío: quien envía = el usuario → pre-rellenar con sus datos
  useEffect(() => {
    if (nombre || telefono) return;
    clienteDb.profile.get("me").then((user) => {
      if (!user) return;
      const displayName = [user.nombre, user.apellido].filter(Boolean).join(" ");
      if (!nombre && displayName) setNombre(displayName);
      if (!telefono && user.telefono) setTelefono(user.telefono);
    }).catch(() => {});
  }, []);

  const canNext = nombre.trim() && onlyDigits(telefono).length >= 6;

  function handleNext() {
    setContactFromName(nombre.trim());
    setContactFrom(onlyDigits(telefono));
    setPickupReference(referencia.trim());
    setNotesFrom(nota.trim());
    next();
  }

  return (
    <div className={styles.step}>
      <div className={styles.content}>
        <div className={styles.addressBar}>
          <span className={styles.addrDot} />
          <span className={styles.addrText}>{state.origin || "—"}</span>
        </div>

        <p className={styles.hint}>¿Quién va a entregar el paquete en este domicilio?</p>

        <div className={styles.fields}>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="origen-nombre">Nombre</label>
              <input id="origen-nombre" className={styles.input} type="text"
                placeholder="Nombre y apellido"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="origen-tel">Teléfono</label>
              <input id="origen-tel" className={styles.input} type="tel" inputMode="numeric"
                placeholder="Sin 0 y sin 15"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="origen-ref">Piso, local o referencia</label>
            <input id="origen-ref" className={styles.input} type="text"
              placeholder="Ej: piso 3, local 2, casa del fondo…"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="origen-nota">Aclaración para retirar <span className={styles.optional}>(opcional)</span></label>
            <textarea id="origen-nota" className={styles.textarea}
              placeholder="Ej: tocar timbre, preguntar por Ana…"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2} maxLength={160} />
            <span className={styles.counter}>{nota.length}/160</span>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.nextBtn} onClick={handleNext} disabled={!canNext}>
          Continuar {arrowIcon}
        </button>
      </div>
    </div>
  );
}

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
