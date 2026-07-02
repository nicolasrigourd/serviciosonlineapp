import React, { useEffect, useState } from "react";
import styles from "./ArrivalAlert.module.css";

export default function ArrivalAlert() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Pequeño delay para que la animación entre sea visible
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`${styles.banner} ${visible ? styles.bannerVisible : ""}`} role="alert">
      <div className={styles.iconWrap}>
        {motoIcon}
      </div>
      <div className={styles.text}>
        <strong>El repartidor está llegando</strong>
        <span>A menos de 2 minutos</span>
      </div>
      <div className={styles.pulse} />
    </div>
  );
}

const motoIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="2.5"/>
    <circle cx="18.5" cy="17.5" r="2.5"/>
    <path d="M15 6h2l3 5.5M8 6l-1 6h11"/>
    <path d="M3 17.5h2M16 17.5h2"/>
  </svg>
);
