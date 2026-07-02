import React, { useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useFlowWizard } from "../../../components/FlowWizard/FlowWizard";
import styles from "./StepPago.module.css";

function fmtARS(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

export default function StepAdelanto() {
  const { state, setPickupPayment } = useFlow();
  const { next } = useFlowWizard();

  const [pickupYes, setPickupYes] = useState(state.pickupPaymentRequired ?? false);
  const [pickupAmt, setPickupAmt] = useState(
    state.pickupPaymentAmount > 0 ? String(state.pickupPaymentAmount) : ""
  );

  const pickupAmtNum  = Number(onlyDigits(pickupAmt)) || 0;
  const canNext       = !pickupYes || pickupAmtNum > 0;
  const servicePrice  = Number(state.price) || 0;
  const totalEstimado = servicePrice + (pickupYes ? pickupAmtNum : 0);

  function handleToggle(val) {
    setPickupYes(val);
    if (!val) {
      setPickupAmt("");
      setPickupPayment(false, 0);
    }
  }

  function handleAmt(v) {
    const clean = onlyDigits(v);
    setPickupAmt(clean);
    setPickupPayment(true, Number(clean) || 0);
  }

  function handleNext() {
    setPickupPayment(pickupYes, pickupAmtNum);
    next();
  }

  return (
    <div className={styles.step}>
      <div className={styles.content}>

        <div className={styles.priceSummary}>
          <span className={styles.priceLbl}>Servicio de envío</span>
          <span className={styles.priceVal}>{fmtARS(servicePrice)}</span>
        </div>

        <section className={styles.section}>
          <p className={styles.qTitle}>¿El repartidor debe pagar algo al retirar?</p>
          <p className={styles.qSub}>Por ejemplo, si el vendedor cobra contra retiro.</p>

          <div className={styles.boolRow}>
            <button
              type="button"
              className={`${styles.boolBtn} ${!pickupYes ? styles.boolActive : ""}`}
              onClick={() => handleToggle(false)}
            >
              {noIcon}
              <span>No</span>
            </button>
            <button
              type="button"
              className={`${styles.boolBtn} ${pickupYes ? styles.boolActiveWarn : ""}`}
              onClick={() => handleToggle(true)}
            >
              {yesIcon}
              <span>Sí, debe pagar</span>
            </button>
          </div>

          {pickupYes && (
            <div className={styles.amountRow}>
              <span className={styles.amountPrefix}>$</span>
              <input
                type="tel"
                inputMode="numeric"
                className={styles.amountInput}
                placeholder="0"
                value={pickupAmt}
                onChange={(e) => handleAmt(e.target.value)}
                autoFocus
              />
              <span className={styles.amountSuffix}>ARS</span>
            </div>
          )}

          {pickupYes && pickupAmtNum > 0 && (
            <p className={styles.infoChip}>
              El repartidor adelantará {fmtARS(pickupAmtNum)} · Total a cobrar: {fmtARS(totalEstimado)}
            </p>
          )}
        </section>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={!canNext}
        >
          Continuar {arrowIcon}
        </button>
      </div>
    </div>
  );
}

const noIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>
  </svg>
);

const yesIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
