import React from "react";
import styles from "./HomeActionCard.module.css";

/**
 * props:
 * - icon: ReactNode
 * - title: string
 * - desc: string
 * - tone?: "blue" | "green" | "orange" | "purple" | "yellow" (accents sutiles)
 * - onClick?: () => void
 * - badge?: string (opcional, ej: "Nuevo")
 * - disabled?: boolean (opcional)
 */
export default function HomeActionCard({
  icon,
  title,
  desc,
  tone = "blue",
  onClick,
  badge,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={[
        styles.card,
        styles[`tone_${tone}`],
        disabled ? styles.disabled : "",
      ].join(" ")}
      onClick={disabled ? undefined : onClick}
      aria-label={title}
      disabled={disabled}
    >
      {!!badge && <span className={styles.badge}>{badge}</span>}
      <span className={`${styles.iconCircle} ${styles[`icon_${tone}`]}`}>{icon}</span>
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.cardDesc}>{desc}</span>
    </button>
  );
}
