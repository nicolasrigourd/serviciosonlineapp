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
        image ? styles.hasImage : styles.onlyIcon,
      ].join(" ")}
      onClick={disabled ? undefined : onClick}
      aria-label={title}
      disabled={disabled}
    >
      {!!badge && <span className={styles.badge}>{badge}</span>}

      <span className={styles.mediaStage} aria-hidden="true">
        {image ? (
          <img className={styles.serviceImage} src={image} alt="" />
        ) : (
          <span className={styles.iconWrap}>{icon}</span>
        )}
      </span>

      <span className={styles.textBlock}>
        <span className={styles.cardTitle}>{title}</span>

        {desc ? <span className={styles.cardDesc}>{desc}</span> : null}
      </span>
    </button>
  );
}