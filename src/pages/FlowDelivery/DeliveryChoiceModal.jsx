import React, { useState } from "react";
import styles from "./DeliveryChoiceModal.module.css";

export default function DeliveryChoiceModal({ onChoose, onClose }) {
  const [chosen, setChosen] = useState(null);

  function handleSelect(mode) {
    setChosen(mode);
    setTimeout(() => onChoose(mode), 160);
  }

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Encabezado */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>{deliveryIcon}</div>
            <div className={styles.headerText}>
              <p className={styles.headerTitle}>Delivery</p>
              <p className={styles.headerSub}>¿Qué necesitás hacer?</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            {closeIcon}
          </button>
        </div>

        {/* Opciones */}
        <div className={styles.cards}>

          <button
            type="button"
            className={`${styles.card} ${chosen === "envio" ? styles.cardActive : ""}`}
            onClick={() => handleSelect("envio")}
          >
            <div className={`${styles.cardIcon} ${styles.cardIconSend}`}>{sendIcon}</div>
            <div className={styles.cardText}>
              <span className={styles.cardTitle}>Enviar pedido</span>
              <span className={styles.cardDesc}>El repartidor lleva el pedido hasta el cliente</span>
            </div>
            <div className={styles.cardArrow}>{arrowIcon}</div>
          </button>

          <button
            type="button"
            className={`${styles.card} ${chosen === "retiro" ? styles.cardActive : ""}`}
            onClick={() => handleSelect("retiro")}
          >
            <div className={`${styles.cardIcon} ${styles.cardIconPickup}`}>{pickupIcon}</div>
            <div className={styles.cardText}>
              <span className={styles.cardTitle}>Retirar pedido</span>
              <span className={styles.cardDesc}>El repartidor retira el pedido de tu comercio</span>
            </div>
            <div className={styles.cardArrow}>{arrowIcon}</div>
          </button>

        </div>
      </div>
    </div>
  );
}

const deliveryIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
    <rect x="9" y="11" width="14" height="10" rx="2"/>
    <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
  </svg>
);

const sendIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const pickupIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

const closeIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);
