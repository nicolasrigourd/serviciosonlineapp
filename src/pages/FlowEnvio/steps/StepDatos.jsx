import React, { useEffect, useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useFlowWizard } from "../../../components/FlowWizard/FlowWizard";
import { clienteDb } from "../../../db/clienteDb";
import { calcularAdicionalManejo } from "../../../lib/cashHandling";
import styles from "./StepContacto.module.css";

function fmtARS(n) { return `$${Number(n || 0).toLocaleString("es-AR")}`; }
function shortAddr(addr) {
  if (!addr) return "—";
  const parts = addr.split(",");
  return parts[0].trim();
}

function onlyDigits(v) { return String(v || "").replace(/\D/g, ""); }

export default function StepDatos() {
  const {
    state,
    setContactFromName, setContactFrom,
    setPickupFloor, setPickupApartment, setNotesFrom,
    setRecipientName, setRecipientPhone,
    setDropoffFloor, setDropoffApartment, setNotesTo,
  } = useFlow();
  const { next } = useFlowWizard();

  const [fromNombre,   setFromNombre]   = useState(state.contactFromName  || "");
  const [fromTelefono, setFromTelefono] = useState(state.contactFrom      || "");
  const [fromPiso,     setFromPiso]     = useState(state.pickupFloor      || "");
  const [fromDpto,     setFromDpto]     = useState(state.pickupApartment  || "");
  const [fromNota,     setFromNota]     = useState(state.notesFrom        || "");

  const [toNombre,   setToNombre]   = useState(state.recipientName    || "");
  const [toTelefono, setToTelefono] = useState(state.recipientPhone   || "");
  const [toPiso,     setToPiso]     = useState(state.dropoffFloor     || "");
  const [toDpto,     setToDpto]     = useState(state.dropoffApartment || "");
  const [toNota,     setToNota]     = useState(state.notesTo          || "");

  // Pre-llenar el contacto del usuario cuando se conoce el tipo de operación.
  // envio → pre-llena quien entrega (sección 1); retiro → quien recibe (sección 2).
  useEffect(() => {
    const op = state.operationType;
    if (!op) return;
    const isRetiro        = op === "retiro";
    const isCompras       = op === "compras";
    const isValoresRetiro = op === "valores" && state.valoresMode === "retiro";
    // retiro, compras y valores-retiro pre-llenan quien recibe; los demás pre-llenan quien entrega
    const prefillDest = isRetiro || isCompras || isValoresRetiro;
    if (prefillDest ? (toNombre || toTelefono) : (fromNombre || fromTelefono)) return;
    clienteDb.profile.get("me").then((user) => {
      if (!user) return;
      const displayName = [user.nombre, user.apellido].filter(Boolean).join(" ");
      if (prefillDest) {
        if (!toNombre   && displayName)   setToNombre(displayName);
        if (!toTelefono && user.telefono) setToTelefono(user.telefono);
      } else {
        if (!fromNombre   && displayName)   setFromNombre(displayName);
        if (!fromTelefono && user.telefono) setFromTelefono(user.telefono);
      }
    }).catch(() => {});
  }, [state.operationType]);

  const isRetiro        = state.operationType === "retiro";
  const isCompras       = state.operationType === "compras";
  const isValores       = state.operationType === "valores";
  const isValoresRetiro = isValores && state.valoresMode === "retiro";
  const servicePrice    = Number(state.price) || 0;

  const fromOk  = fromNombre.trim() && onlyDigits(fromTelefono).length >= 6;
  const toOk    = toNombre.trim() && onlyDigits(toTelefono).length >= 6;
  const canNext = isCompras ? toOk : (fromOk && toOk);

  function handleNext() {
    setContactFromName(fromNombre.trim());
    setContactFrom(onlyDigits(fromTelefono));
    setPickupFloor(fromPiso.trim());
    setPickupApartment(fromDpto.trim());
    setNotesFrom(fromNota.trim());
    setRecipientName(toNombre.trim());
    setRecipientPhone(onlyDigits(toTelefono));
    setDropoffFloor(toPiso.trim());
    setDropoffApartment(toDpto.trim());
    setNotesTo(toNota.trim());
    next();
  }
  const pickupAmt       = state.pickupPaymentRequired ? (Number(state.pickupPaymentAmount) || 0) : 0;
  const cashHandlingFee = calcularAdicionalManejo(pickupAmt, state.cashHandlingFeeConfig);
  const serviceTotal    = servicePrice + cashHandlingFee;  // sin adelanto

  return (
    <div className={styles.step}>
      <div className={styles.content}>

        {/* ── Referencia del pedido ─────────────────────────────── */}
        <div className={styles.priceBanner}>
          <div className={styles.bannerRoute}>
            <span className={`${styles.bannerDot} ${styles.bannerDotFrom}`} />
            <span className={styles.bannerAddr}>{shortAddr(state.origin)}</span>
            <span className={styles.bannerArrow}>→</span>
            <span className={`${styles.bannerDot} ${styles.bannerDotTo}`} />
            <span className={styles.bannerAddr}>{shortAddr(state.destination)}</span>
          </div>
          <div className={styles.bannerRight}>
            <span className={styles.bannerPrice}>{fmtARS(serviceTotal)}</span>
            {state.km ? <span className={styles.bannerKm}>{state.km} km</span> : null}
          </div>
        </div>

        {/* ── Quién entrega (oculto en compras — el origen es el comercio) ── */}
        {!isCompras && <div className={styles.sectionBlock}>
          <div className={styles.addressBar}>
            <span className={styles.addrDot} />
            <span className={styles.addrText}>{state.origin || "—"}</span>
          </div>

          <p className={styles.hint}>{isValores ? "Quién entrega el dinero" : isRetiro ? "Quién tiene el paquete" : "Quién entrega"}</p>

          <div className={styles.fields}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="from-nombre">Nombre</label>
                <input id="from-nombre" className={styles.input} type="text"
                  placeholder="Nombre y apellido"
                  value={fromNombre}
                  onChange={(e) => setFromNombre(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="from-tel">Teléfono</label>
                <input id="from-tel" className={styles.input} type="tel" inputMode="numeric"
                  placeholder="Sin 0 y sin 15"
                  value={fromTelefono}
                  onChange={(e) => setFromTelefono(e.target.value)} />
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="from-piso">Piso</label>
                <input id="from-piso" className={styles.input} type="text"
                  placeholder="Ej: 3°"
                  value={fromPiso}
                  onChange={(e) => setFromPiso(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="from-dpto">
                  Dpto / Local <span className={styles.optional}>(opc)</span>
                </label>
                <input id="from-dpto" className={styles.input} type="text"
                  placeholder="Ej: B, local 2"
                  value={fromDpto}
                  onChange={(e) => setFromDpto(e.target.value)} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="from-nota">
                Aclaración <span className={styles.optional}>(opcional)</span>
              </label>
              <textarea id="from-nota" className={styles.textarea}
                placeholder="Ej: tocar timbre, preguntar por Ana…"
                value={fromNota}
                onChange={(e) => setFromNota(e.target.value)}
                rows={2} maxLength={120} />
            </div>
          </div>
        </div>
        }

        {!isCompras && <div className={styles.sectionDivider} />}

        {/* ── Quién recibe ──────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <div className={`${styles.addressBar} ${styles.addressBarDest}`}>
            <span className={`${styles.addrDot} ${styles.addrDotDest}`} />
            <span className={styles.addrText}>{state.destination || "—"}</span>
          </div>

          <p className={styles.hint}>{isCompras ? "¿A quién le llevamos las compras?" : isValores ? "Quién recibe el dinero" : "Quién recibe"}</p>

          <div className={styles.fields}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="to-nombre">Nombre</label>
                <input id="to-nombre" className={styles.input} type="text"
                  placeholder="Nombre y apellido"
                  value={toNombre}
                  onChange={(e) => setToNombre(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="to-tel">Teléfono</label>
                <input id="to-tel" className={styles.input} type="tel" inputMode="numeric"
                  placeholder="Sin 0 y sin 15"
                  value={toTelefono}
                  onChange={(e) => setToTelefono(e.target.value)} />
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="to-piso">Piso</label>
                <input id="to-piso" className={styles.input} type="text"
                  placeholder="Ej: 7°"
                  value={toPiso}
                  onChange={(e) => setToPiso(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="to-dpto">
                  Dpto / Local <span className={styles.optional}>(opc)</span>
                </label>
                <input id="to-dpto" className={styles.input} type="text"
                  placeholder="Ej: B, local 3"
                  value={toDpto}
                  onChange={(e) => setToDpto(e.target.value)} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="to-nota">
                Aclaración <span className={styles.optional}>(opcional)</span>
              </label>
              <textarea id="to-nota" className={styles.textarea}
                placeholder="Ej: dejar en recepción, llamar antes de llegar…"
                value={toNota}
                onChange={(e) => setToNota(e.target.value)}
                rows={2} maxLength={120} />
            </div>
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
