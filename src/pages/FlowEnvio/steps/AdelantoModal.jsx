import React, { useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { calcularAdicionalManejo } from "../../../lib/cashHandling";
import styles from "./AdelantoModal.module.css";

function onlyDigits(v) { return String(v || "").replace(/\D/g, ""); }
function fmtARS(n)    { return `$${Number(n || 0).toLocaleString("es-AR")}`; }

export default function AdelantoModal({ onNext }) {
  const { state, setPickupPayment } = useFlow();

  const [choice, setChoice] = useState(
    state.pickupPaymentRequired === true  ? "yes" :
    state.pickupPaymentRequired === false ? "no"  : null
  );
  const [amount, setAmount] = useState(
    state.pickupPaymentAmount > 0 ? String(state.pickupPaymentAmount) : ""
  );

  const amountNum       = Number(onlyDigits(amount)) || 0;
  const canContinue     = choice === "no" || (choice === "yes" && amountNum > 0);
  const servicePrice    = Number(state.price) || 0;
  const handlingFee = calcularAdicionalManejo(amountNum, state.cashHandlingFeeConfig);

  function handleNo() {
    setChoice("no");
    setAmount("");
    setPickupPayment(false, 0);
  }

  function handleYes() {
    setChoice("yes");
  }

  function handleAmount(v) {
    const clean = onlyDigits(v);
    setAmount(clean);
    setPickupPayment(true, Number(clean) || 0);
  }

  function handleContinue() {
    if (!canContinue) return;
    if (choice === "no") setPickupPayment(false, 0);
    else setPickupPayment(true, amountNum);
    onNext();
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>

        <div className={styles.header}>
          <div className={styles.headerIcon}>{alertIcon}</div>
          <div>
            <p className={styles.headerTitle}>Antes de continuar</p>
            <p className={styles.headerSub}>Servicio estimado: {fmtARS(servicePrice)}</p>
          </div>
        </div>

        <div className={styles.body}>
          <p className={styles.question}>
            ¿Hay algo que el repartidor deba pagar al retirar el paquete?
          </p>
          <p className={styles.hint}>
            Por ejemplo, si quien vende cobra contra retiro.
          </p>

          <div className={styles.choices}>
            <button
              type="button"
              className={`${styles.choiceBtn} ${choice === "no" ? styles.choiceNo : ""}`}
              onClick={handleNo}
            >
              {noIcon}
              <span>No, nada</span>
            </button>
            <button
              type="button"
              className={`${styles.choiceBtn} ${choice === "yes" ? styles.choiceYes : ""}`}
              onClick={handleYes}
            >
              {yesIcon}
              <span>Sí, debe pagar</span>
            </button>
          </div>

          {choice === "yes" && (
            <div className={styles.amountBlock}>
              <p className={styles.amountLabel}>¿Cuánto debe adelantar?</p>
              <div className={styles.amountRow}>
                <span className={styles.amountPrefix}>$</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  className={styles.amountInput}
                  placeholder="0"
                  value={amount}
                  onChange={(e) => handleAmount(e.target.value)}
                  autoFocus
                />
                <span className={styles.amountSuffix}>ARS</span>
              </div>
              {amountNum > 0 && (
                <>
                  {handlingFee > 0 && (
                    <p className={styles.amountNote}>
                      + {fmtARS(handlingFee)} adicional por manejo de efectivo
                    </p>
                  )}
                  <p className={styles.amountNote}>
                    El repartidor cobrará {fmtARS(amountNum + handlingFee)} de adelanto
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.continueBtn}
            onClick={handleContinue}
            disabled={!canContinue}
          >
            Continuar {arrowIcon}
          </button>
        </div>
      </div>
    </div>
  );
}

const alertIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const noIcon = (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>
  </svg>
);

const yesIcon = (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
