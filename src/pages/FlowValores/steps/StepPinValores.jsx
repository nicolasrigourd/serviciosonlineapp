import React, { useRef, useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useFlowWizard } from "../../../components/FlowWizard/FlowWizard";
import styles from "./StepPinValores.module.css";

const LEN = 4;

export default function StepPinValores() {
  const { setSecurityPin } = useFlow();
  const { next } = useFlowWizard();

  const [pin,     setPin]     = useState(Array(LEN).fill(""));
  const [confirm, setConfirm] = useState(Array(LEN).fill(""));
  const [touched, setTouched] = useState(false);

  const pinRefs     = Array.from({ length: LEN }, () => useRef(null));
  const confirmRefs = Array.from({ length: LEN }, () => useRef(null));

  const pinStr     = pin.join("");
  const confirmStr = confirm.join("");
  const pinFull    = pinStr.length === LEN;
  const mismatch   = touched && pinFull && confirmStr.length === LEN && pinStr !== confirmStr;
  const canNext    = pinFull && confirmStr.length === LEN && pinStr === confirmStr;

  function handleDigit(arr, setArr, refs, index, value) {
    const d = value.replace(/\D/g, "").slice(-1);
    const next_ = [...arr];
    next_[index] = d;
    setArr(next_);
    if (d && index < LEN - 1) refs[index + 1].current?.focus();
  }

  function handleKey(arr, setArr, refs, index, e) {
    if (e.key === "Backspace") {
      if (arr[index]) {
        const next_ = [...arr];
        next_[index] = "";
        setArr(next_);
      } else if (index > 0) {
        refs[index - 1].current?.focus();
        const next_ = [...arr];
        next_[index - 1] = "";
        setArr(next_);
      }
    }
  }

  function handleNext() {
    if (!canNext) return;
    setSecurityPin(pinStr);
    next();
  }

  function handlePinComplete() {
    if (pinStr.length === LEN) {
      setTouched(true);
      confirmRefs[0].current?.focus();
    }
  }

  return (
    <div className={styles.step}>
      <div className={styles.content}>

        <div className={styles.iconWrap}>{lockIcon}</div>
        <h2 className={styles.heading}>Creá tu PIN de seguridad</h2>
        <p className={styles.sub}>
          Solo vos conocés este PIN. Compartíselo únicamente a quien va a recibir el dinero.
          El repartidor lo ingresa al entregar.
        </p>

        {/* PIN */}
        <div className={styles.pinBlock}>
          <label className={styles.pinLabel}>PIN de 4 dígitos</label>
          <div className={styles.pinRow}>
            {pin.map((val, i) => (
              <input
                key={i}
                ref={pinRefs[i]}
                className={`${styles.pinBox} ${val ? styles.pinBoxFilled : ""}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={val}
                onChange={(e) => handleDigit(pin, setPin, pinRefs, i, e.target.value)}
                onKeyDown={(e) => handleKey(pin, setPin, pinRefs, i, e)}
                onBlur={() => { if (i === LEN - 1) handlePinComplete(); }}
                autoComplete="off"
              />
            ))}
          </div>
        </div>

        {/* Confirmar PIN */}
        <div className={styles.pinBlock}>
          <label className={styles.pinLabel}>Confirmá el PIN</label>
          <div className={styles.pinRow}>
            {confirm.map((val, i) => (
              <input
                key={i}
                ref={confirmRefs[i]}
                className={`${styles.pinBox} ${val ? styles.pinBoxFilled : ""} ${mismatch ? styles.pinBoxError : ""}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={val}
                onChange={(e) => {
                  setTouched(true);
                  handleDigit(confirm, setConfirm, confirmRefs, i, e.target.value);
                }}
                onKeyDown={(e) => handleKey(confirm, setConfirm, confirmRefs, i, e)}
                autoComplete="off"
              />
            ))}
          </div>
          {mismatch && (
            <p className={styles.errorMsg}>Los PIN no coinciden. Volvé a intentarlo.</p>
          )}
          {canNext && (
            <p className={styles.successMsg}>{checkIcon} PIN confirmado</p>
          )}
        </div>

        <div className={styles.warningCard}>
          {warnIcon}
          <p>
            Si perdés el PIN no podremos recuperarlo. Anotálo o compartíselo ahora al destinatario.
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

const lockIcon = (
  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
    <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
  </svg>
);

const checkIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}>
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

const warnIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
