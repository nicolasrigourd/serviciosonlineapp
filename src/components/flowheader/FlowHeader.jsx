import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./FlowHeader.module.css";

export default function FlowHeader({ title = "Envíos" }) {
  const navigate = useNavigate();
  return (
    <header className={styles.header}>
      <button type="button" className={styles.iconBtn} aria-label="Volver" onClick={() => navigate(-1)}>
        {backIcon}
      </button>
      <div className={styles.title}>{title}</div>
      <div className={styles.rightSpacer} aria-hidden="true" />
    </header>
  );
}

const backIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
