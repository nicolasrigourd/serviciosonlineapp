import React from "react";
import styles from "./CardDirecciones.module.css";

/**
 * props:
 * - title: string
 * - address: string
 * - piso?: string
 * - subtitle?: string
 * - isDefault?: bool
 * - quick?: bool
 * - onUse?: () => void
 * - onEdit?: () => void
 * - onDelete?: () => void
 * - onSelectCurrent?: () => void
 * - onToggleQuick?: () => void
 */
export default function CardDirecciones({
  title,
  address,
  piso,
  subtitle,
  isDefault,
  quick,
  onUse,
  onEdit,
  onDelete,
  onSelectCurrent,
  onToggleQuick,
}) {
  const mainLine = address
    ? address + (piso ? `, ${piso}` : "")
    : "—";

  return (
    <article
      className={`${styles.card} ${isDefault ? styles.isCurrent : styles.isOther}`}
      aria-label={`Dirección ${title || ""}`}
    >
      <div className={styles.cardMain}>
        <div className={styles.iconBox} aria-hidden="true">
          {pinIcon}
        </div>

        <div className={styles.content}>
          <header className={styles.head}>
            <div className={styles.titleRow}>
              <h3 className={styles.title}>{title || "Dirección"}</h3>

              {isDefault && <span className={styles.badge}>Actual</span>}

              {quick && <span className={styles.quickBadge}>Rápida</span>}
            </div>
          </header>

          <div className={styles.body}>
            <p className={styles.address}>{mainLine}</p>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
        </div>
      </div>

      <footer className={styles.foot}>
        <div className={styles.leftActions}>
          {onUse && (
            <button type="button" className={styles.btnPrimary} onClick={onUse}>
              Usar
            </button>
          )}

          {onSelectCurrent && !isDefault && (
            <button
              type="button"
              className={styles.btnSelect}
              onClick={onSelectCurrent}
            >
              Usar como actual
            </button>
          )}
        </div>

        <div className={styles.rightActions}>
          {onToggleQuick && (
            <button
              type="button"
              className={`${styles.iconBtn} ${quick ? styles.iconBtnActive : ""}`}
              onClick={onToggleQuick}
              aria-label={
                quick
                  ? "Quitar de accesos rápidos"
                  : "Agregar a accesos rápidos"
              }
              title={
                quick
                  ? "Quitar de accesos rápidos"
                  : "Agregar a accesos rápidos"
              }
            >
              {starIcon}
            </button>
          )}

          {onEdit && (
            <button type="button" className={styles.btnGhost} onClick={onEdit}>
              Editar
            </button>
          )}

          {onDelete && (
            <button type="button" className={styles.btnDanger} onClick={onDelete}>
              Eliminar
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

const pinIcon = (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.4" />
  </svg>
);

const starIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 3.2l2.55 5.17 5.7.83-4.13 4.02.97 5.68L12 16.22 6.91 18.9l.97-5.68L3.75 9.2l5.7-.83L12 3.2z" />
  </svg>
);