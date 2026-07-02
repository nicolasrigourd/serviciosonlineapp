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

export default function StepPago() {
  const {
    state,
    setPickupPayment,
    setServiceChargedTo,
    setPaymentMethod,
  } = useFlow();
  const { next } = useFlowWizard();

  const [pickupYes, setPickupYes]     = useState(state.pickupPaymentRequired ?? false);
  const [pickupAmt, setPickupAmt]     = useState(state.pickupPaymentAmount > 0 ? String(state.pickupPaymentAmount) : "");
  const [chargedTo, setChargedTo]     = useState(state.serviceChargedTo || "remitente");
  const [method,    setMethod]        = useState(state.paymentMethod || "");

  const pickupAmtNum = Number(onlyDigits(pickupAmt)) || 0;
  const pickupValid  = !pickupYes || pickupAmtNum > 0;
  const canNext      = pickupValid && chargedTo && method;

  function handlePickupToggle(val) {
    setPickupYes(val);
    if (!val) {
      setPickupAmt("");
      setPickupPayment(false, 0);
    }
  }

  function handlePickupAmt(v) {
    const clean = onlyDigits(v);
    setPickupAmt(clean);
    setPickupPayment(true, Number(clean) || 0);
  }

  function handleChargedTo(val) {
    setChargedTo(val);
    setServiceChargedTo(val);
  }

  function handleMethod(val) {
    setMethod(val);
    setPaymentMethod(val);
  }

  function handleNext() {
    setPickupPayment(pickupYes, pickupAmtNum);
    setServiceChargedTo(chargedTo);
    setPaymentMethod(method);
    next();
  }

  // Precio de servicio ya calculado en paso anterior
  const servicePrice = Number(state.price) || 0;
  const totalConAdelanto = servicePrice + (pickupYes ? pickupAmtNum : 0);

  return (
    <div className={styles.step}>
      <div className={styles.content}>

        {/* Resumen de precio del servicio */}
        <div className={styles.priceSummary}>
          <span className={styles.priceLbl}>Servicio de envío</span>
          <span className={styles.priceVal}>{fmtARS(servicePrice)}</span>
        </div>

        {/* ── Q1: ¿pago en origen? ─────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span className={styles.qNum}>01</span>
            <div>
              <p className={styles.qTitle}>¿El repartidor debe pagar algo al retirar?</p>
              <p className={styles.qSub}>Por ejemplo: si el vendedor cobra contra retiro.</p>
            </div>
          </div>

          <div className={styles.boolRow}>
            <button
              type="button"
              className={`${styles.boolBtn} ${!pickupYes ? styles.boolActive : ""}`}
              onClick={() => handlePickupToggle(false)}
            >
              {noIcon}
              <span>No</span>
            </button>
            <button
              type="button"
              className={`${styles.boolBtn} ${pickupYes ? styles.boolActiveWarn : ""}`}
              onClick={() => handlePickupToggle(true)}
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
                onChange={(e) => handlePickupAmt(e.target.value)}
                autoFocus
              />
              <span className={styles.amountSuffix}>ARS</span>
            </div>
          )}

          {pickupYes && pickupAmtNum > 0 && (
            <p className={styles.infoChip}>
              El repartidor adelantará {fmtARS(pickupAmtNum)} · Total a cobrar: {fmtARS(totalConAdelanto)}
            </p>
          )}
        </section>

        {/* ── Q2: ¿quién abona el servicio? ────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span className={styles.qNum}>02</span>
            <div>
              <p className={styles.qTitle}>¿Quién abona el servicio?</p>
              <p className={styles.qSub}>El costo del envío lo paga…</p>
            </div>
          </div>

          <div className={styles.chargeRow}>
            <button
              type="button"
              className={`${styles.chargeCard} ${chargedTo === "remitente" ? styles.chargeActive : ""}`}
              onClick={() => handleChargedTo("remitente")}
            >
              <span className={styles.chargeIcon}>{senderIcon}</span>
              <strong>Yo (remitente)</strong>
              <span>Pagás vos ahora</span>
            </button>
            <button
              type="button"
              className={`${styles.chargeCard} ${chargedTo === "destinatario" ? styles.chargeActive : ""}`}
              onClick={() => handleChargedTo("destinatario")}
            >
              <span className={styles.chargeIcon}>{receiverIcon}</span>
              <strong>Quien recibe</strong>
              <span>Paga al recibir</span>
            </button>
          </div>
        </section>

        {/* ── Q3: método de pago ───────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span className={styles.qNum}>03</span>
            <div>
              <p className={styles.qTitle}>¿Cómo se paga?</p>
              <p className={styles.qSub}>Forma de pago del servicio.</p>
            </div>
          </div>

          <div className={styles.methodRow}>
            <button
              type="button"
              className={`${styles.methodBtn} ${method === "cash" ? styles.methodActive : ""}`}
              onClick={() => handleMethod("cash")}
            >
              {cashIcon}
              <span>Efectivo</span>
            </button>
            <button
              type="button"
              className={`${styles.methodBtn} ${method === "mercadopago" ? styles.methodActive : ""}`}
              onClick={() => handleMethod("mercadopago")}
            >
              {mpIcon}
              <span>MercadoPago</span>
            </button>
          </div>
        </section>
      </div>

      {/* Footer con siguiente */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={!canNext}
        >
          Continuar
          {arrowIcon}
        </button>
      </div>
    </div>
  );
}

/* ── Íconos ──────────────────────────────────────────────────── */

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

const senderIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

const receiverIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    <path d="M19 3l2 2-5 5"/>
  </svg>
);

const cashIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="6" width="18" height="12" rx="2.5"/>
    <circle cx="12" cy="12" r="2.3"/>
  </svg>
);

const mpIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="5" width="20" height="14" rx="3"/>
    <path d="M2 10h20"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
