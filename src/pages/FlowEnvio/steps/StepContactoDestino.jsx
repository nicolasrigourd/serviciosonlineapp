import React, { useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useFlowWizard } from "../../../components/FlowWizard/FlowWizard";
import styles from "./StepContacto.module.css";

function onlyDigits(v) { return String(v || "").replace(/\D/g, ""); }

export default function StepContactoDestino() {
  const { state, setRecipientName, setRecipientPhone, setDropoffReference, setNotesTo } = useFlow();
  const { next } = useFlowWizard();

  const [nombre,    setNombre]    = useState(state.recipientName || "");
  const [telefono,  setTelefono]  = useState(state.recipientPhone || "");
  const [referencia,setReferencia]= useState(state.dropoffReference || "");
  const [nota,      setNota]      = useState(state.notesTo || "");

  const canNext = nombre.trim() && onlyDigits(telefono).length >= 6;

  function handleNext() {
    setRecipientName(nombre.trim());
    setRecipientPhone(onlyDigits(telefono));
    setDropoffReference(referencia.trim());
    setNotesTo(nota.trim());
    next();
  }

  return (
    <div className={styles.step}>
      <div className={styles.content}>
        <div className={`${styles.addressBar} ${styles.addressBarDest}`}>
          <span className={`${styles.addrDot} ${styles.addrDotDest}`} />
          <span className={styles.addrText}>{state.destination || "—"}</span>
        </div>

        <p className={styles.hint}>¿Quién va a recibir el paquete en este domicilio?</p>

        <div className={styles.fields}>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="dest-nombre">Nombre</label>
              <input id="dest-nombre" className={styles.input} type="text"
                placeholder="Nombre y apellido"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="dest-tel">Teléfono</label>
              <input id="dest-tel" className={styles.input} type="tel" inputMode="numeric"
                placeholder="Sin 0 y sin 15"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dest-ref">Piso, dpto o referencia</label>
            <input id="dest-ref" className={styles.input} type="text"
              placeholder="Ej: 7 B, local 3, casa del fondo…"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dest-nota">Aclaración para entregar <span className={styles.optional}>(opcional)</span></label>
            <textarea id="dest-nota" className={styles.textarea}
              placeholder="Ej: dejar en recepción, llamar antes de llegar…"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2} maxLength={160} />
            <span className={styles.counter}>{nota.length}/160</span>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.nextBtn} onClick={handleNext} disabled={!canNext}>
          Ver resumen {arrowIcon}
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
