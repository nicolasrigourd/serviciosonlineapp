import React from "react";
import styles from "./HomeActionCard.module.css";

export default function HomeActionCard({
  icon,
  image,
  title,
  desc,
  tone = "neutral",
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

      <span className={styles.iconStage} aria-hidden="true">
        {image ? (
          <img className={styles.serviceImage} src={image} alt="" />
        ) : (
          icon
        )}
      </span>

      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.cardDesc}>{desc}</span>
    </button>
  );
}