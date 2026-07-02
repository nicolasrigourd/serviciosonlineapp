import React, { useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useFlowWizard } from "../../../components/FlowWizard/FlowWizard";
import { calcularAdicionalManejo, describeCashHandlingFee } from "../../../lib/cashHandling";
import styles from "./StepMontoValores.module.css";

function fmtARS(n) { return `$${Number(n || 0).toLocaleString("es-AR")}`; }
function onlyDigits(v) { return String(v || "").replace(/\D/g, ""); }

export default function StepMontoValores() {
  const { state, setDeclaredValue } = useFlow();
  const { next } = useFlowWizard();

  const [raw, setRaw] = useState(state.declaredValue > 0 ? String(state.declaredValue) : "");

  const amount  = Number(onlyDigits(raw)) || 0;
  const fee     = calcularAdicionalManejo(amount, state.cashHandlingFeeConfig);
  const feeDesc = describeCashHandlingFee(state.cashHandlingFeeConfig, fmtARS);
  const canNext = amount > 0;

  const isRetiro = state.valoresMode === "retiro";

  function handleNext() {
    setDeclaredValue(amount);
    next();
  }

  return (
    <div className={styles.step}>
      <div className={styles.content}>

        <div className={styles.iconWrap}>
          {moneyIcon}
        </div>

        <h2 className={styles.heading}>
          {isRetiro ? "¿Cuánto dinero vas a retirar?" : "¿Cuánto dinero vas a enviar?"}
        </h2>
        <p className={styles.sub}>
          Este monto se tiene en cuenta para calcular el costo del servicio.
        </p>

        <div className={styles.amountWrap}>
          <span className={styles.prefix}>$</span>
          <input
            className={styles.amountInput}
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={raw}
            onChange={(e) => setRaw(onlyDigits(e.target.value))}
            autoFocus
          />
        </div>

        {amount > 0 && (
          <div className={styles.feeCard}>
            <div className={styles.feeRow}>
              <span className={styles.feeLabel}>Monto a transportar</span>
              <strong className={styles.feeValue}>{fmtARS(amount)}</strong>
            </div>
            {fee > 0 && (
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Cargo por transporte</span>
                <strong className={`${styles.feeValue} ${styles.feeHighlight}`}>+{fmtARS(fee)}</strong>
              </div>
            )}
            {feeDesc && fee > 0 && (
              <p className={styles.feeNote}>{feeDesc}</p>
            )}
          </div>
        )}

        <div className={styles.infoCard}>
          {infoIcon}
          <p>
            El precio final del servicio incluye la distancia más el cargo por
            {isRetiro ? " retiro" : " transporte"} de dinero.
          </p>
        </div>

      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={!canNext}
        >
          Siguiente {arrowIcon}
        </button>
      </div>
    </div>
  );
}

const moneyIcon = (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="3"/>
    <circle cx="12" cy="12" r="2.5"/>
    <path d="M6 12h.01M18 12h.01"/>
  </svg>
);

const infoIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4M12 8h.01"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
