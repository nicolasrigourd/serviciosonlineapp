import React, { useState } from "react";
import styles from "./ValoresChoiceModal.module.css";

const OPTIONS = [
  {
    mode: "envio",
    icon: sendIcon,
    title: "Enviar dinero",
    desc: "El repartidor retira el dinero en tu ubicación y lo lleva al destinatario.",
  },
  {
    mode: "retiro",
    icon: receiveIcon,
    title: "Retirar dinero",
    desc: "El repartidor busca el dinero en otro punto y te lo trae a vos.",
  },
];

export default function ValoresChoiceModal({ onChoose, onClose }) {
  const [chosen, setChosen] = useState(null);

  function handleSelect(mode) {
    setChosen(mode);
    setTimeout(() => onChoose(mode), 160);
  }

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal}>
        <div className={styles.lockBadge}>{shieldIcon}</div>
        <h2 className={styles.title}>Transporte de dinero</h2>
        <p className={styles.subtitle}>¿Qué necesitás hacer?</p>

        <div className={styles.options}>
          {OPTIONS.map(({ mode, icon, title, desc }) => (
            <button
              key={mode}
              type="button"
              className={`${styles.optionCard} ${chosen === mode ? styles.optionSelected : ""}`}
              onClick={() => handleSelect(mode)}
            >
              <span className={styles.optionIcon}>{icon}</span>
              <div className={styles.optionText}>
                <strong className={styles.optionTitle}>{title}</strong>
                <span className={styles.optionDesc}>{desc}</span>
              </div>
            </button>
          ))}
        </div>

        <p className={styles.secNote}>
          {lockIcon} Operación protegida con PIN y ruta de seguridad
        </p>
      </div>
    </div>
  );
}

function sendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

function receiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v10m0 0l-4-4m4 4l4-4"/>
      <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4"/>
    </svg>
  );
}

const shieldIcon = (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);

const lockIcon = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);
