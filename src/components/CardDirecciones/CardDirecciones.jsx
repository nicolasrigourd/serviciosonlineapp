/*
import React from "react";
import styles from "./CardDirecciones.module.css";

export default function CardDirecciones({
  title,
  address,
  subtitle,
  isDefault,
  onUse,
  onEdit,
  onDelete,
  onSelectCurrent,
}) {
  return (
    <article
      className={`${styles.card} ${isDefault ? styles.isCurrent : styles.isOther}`}
      aria-label={`Dirección ${title || ""}`}
    >
      <header className={styles.head}>
        <div className={styles.titleWrap}>
          <span className={styles.pin} aria-hidden="true">📍</span>
          <h3 className={styles.title}>{title || "Dirección"}</h3>
          {isDefault && <span className={styles.badge}>Actual</span>}
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.address}>{address || "—"}</div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>

      <footer className={styles.foot}>
        <div className={styles.leftActions}>
          {onUse && (
            <button type="button" className={styles.btnPrimary} onClick={onUse}>
              Usar
            </button>
          )}
        </div>

        <div className={styles.rightActions}>
          {onSelectCurrent && !isDefault && (
            <button type="button" className={styles.btnSelect} onClick={onSelectCurrent}>
              Seleccionar
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
*/
import React from "react";
import styles from "./CardDirecciones.module.css";

/**
 * props:
 * - title: string                     → título (alias, ej: "Trabajo")
 * - address: string                   → calle y número (obligatorio)
 * - piso?: string                     → piso/dpto (opcional; si viene se muestra junto)
 * - subtitle?: string                 → línea auxiliar
 * - isDefault?: bool                  → pinta como “Actual”
 * - quick?: bool                      → si es acceso rápido (⭐ encendido)
 * - onUse?: () => void                → acción “Usar” (opcional)
 * - onEdit?: () => void               → editar
 * - onDelete?: () => void             → eliminar
 * - onSelectCurrent?: () => void      → hacerla “Actual”
 * - onToggleQuick?: () => void        → marcar/desmarcar acceso rápido (⭐)
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
  // Componemos la línea principal de dirección + piso/dpto si viene
  const mainLine = address
    ? address + (piso ? `, ${piso}` : "")
    : "—";

  return (
    <article
      className={`${styles.card} ${isDefault ? styles.isCurrent : styles.isOther}`}
      aria-label={`Dirección ${title || ""}`}
    >
      <header className={styles.head}>
        <div className={styles.titleWrap}>
          <span className={styles.pin} aria-hidden="true">📍</span>
          <h3 className={styles.title}>{title || "Dirección"}</h3>
          {isDefault && <span className={styles.badge}>Actual</span>}
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.address}>{mainLine}</div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>

      <footer className={styles.foot}>
        <div className={styles.leftActions}>
          {onUse && (
            <button type="button" className={styles.btnPrimary} onClick={onUse}>
              Usar
            </button>
          )}
        </div>

        <div className={styles.rightActions}>
          {/* Acceso rápido (⭐) — usa btnGhost para no cambiar estilos */}
          {onToggleQuick && (
            <button
              type="button"
              className={styles.btnGhost}
              onClick={onToggleQuick}
              aria-label={quick ? "Quitar de accesos rápidos" : "Agregar a accesos rápidos"}
              title={quick ? "Quitar de accesos rápidos" : "Agregar a accesos rápidos"}
            >
              {quick ? "⭐" : "☆"}
            </button>
          )}

          {onSelectCurrent && !isDefault && (
            <button type="button" className={styles.btnSelect} onClick={onSelectCurrent}>
              Seleccionar
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
