import React, { useEffect } from "react";
import styles from "./Modal.module.css";

export function Modal({ open, title, children, onClose }) {
  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = () => onClose?.();
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleBackdropClick}   // 👈 click afuera cierra
    >
      <div className={styles.modal} onClick={stop}> {/* 👈 click adentro NO cierra */}
        {title ? <h3 id="modal-title" className={styles.title}>{title}</h3> : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
