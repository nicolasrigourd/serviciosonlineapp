/*
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ButonCalculo.module.css";

export default function ButonCalculo({
  serviceType,
  origin,
  destination,
  km,
  ratePerKm = 1000,
  onAccept,
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef(null);

  const kms = useMemo(() => Number(km) || 0, [km]);
  const price = useMemo(() => Math.round(kms * ratePerKm), [kms, ratePerKm]);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleAccept = () => {
    onAccept?.({ serviceType, origin, destination, km: kms, price });
    setOpen(false);
  };

  // Bloquear scroll del body y cerrar con ESC
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e) => { if (e.key === "Escape") handleClose(); };
      window.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = prev;
        window.removeEventListener("keydown", onKey);
      };
    }
  }, [open]);

  // Enfocar el sheet al abrir para accesibilidad
  useEffect(() => {
    if (open && sheetRef.current) sheetRef.current.focus();
  }, [open]);

  // Helpers de íconos (inline SVG)
  const IconService = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 7h10v10H3zM13 10h4l4 4v3h-8z" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="17.5" cy="17" r="1.5" />
    </svg>
  );
  const IconPin = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
  const IconFlag = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 4v16M6 4h11l-2 4 2 4H6z" />
    </svg>
  );
  const IconRoad = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 22l4-20M18 22l-4-20" />
      <path d="M12 3v3m0 4v4m0 4v3" />
    </svg>
  );
  const IconMoney = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  const IconClose = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );

  return (
    <>
      <button type="button" className={styles.calcBtn} onClick={handleOpen}>
        Calcular servicio
      </button>

    
      {open && <div className={styles.overlay} onClick={handleClose} />}

      
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${open ? styles.open : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Resumen del servicio"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div className={styles.grabber} aria-hidden="true" />
          <div className={styles.headerRow}>
            <div className={styles.serviceBadge}>
              <span className={styles.badgeIcon}>{IconService}</span>
              <span className={styles.badgeText}>
                {serviceType ? serviceType.toUpperCase() : "—"}
              </span>
            </div>
            <button type="button" className={styles.iconBtn} onClick={handleClose} aria-label="Cerrar">
              {IconClose}
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.item}>
            <div className={styles.itemIcon}>{IconPin}</div>
            <div className={styles.itemContent}>
              <div className={styles.itemKey}>Origen</div>
              <div className={styles.itemVal}>{origin || "—"}</div>
            </div>
          </div>

          <div className={styles.item}>
            <div className={styles.itemIcon}>{IconFlag}</div>
            <div className={styles.itemContent}>
              <div className={styles.itemKey}>Destino</div>
              <div className={styles.itemVal}>{destination || "—"}</div>
            </div>
          </div>

          <div className={styles.item}>
            <div className={styles.itemIcon}>{IconRoad}</div>
            <div className={styles.itemContent}>
              <div className={styles.itemKey}>Distancia</div>
              <div className={styles.itemVal}>{kms ? `${kms} km` : "—"}</div>
              <div className={styles.meta}>Tarifa base: ${ratePerKm.toLocaleString("es-AR")}/km</div>
            </div>
          </div>
        </div>

        <div className={styles.totalBar}>
          <div className={styles.moneyWrap}>
            <span className={styles.moneyIcon}>{IconMoney}</span>
            <span className={styles.totalLabel}>Total</span>
          </div>
          <div className={styles.totalValue}>${price.toLocaleString("es-AR")}</div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={handleClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.acceptBtn}
            onClick={handleAccept}
            disabled={!origin || !destination || !kms}
          >
            Aceptar
          </button>
        </div>
      </div>
    </>
  );
}
*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ButonCalculo.module.css";

export default function ButonCalculo({
  serviceType,
  origin,
  destination,
  km,
  ratePerKm = 1000,

  // 👇 nuevos props opcionales (no rompen compat)
  baseRate = 0,              // tarifa base fija (ej: 1200)
  minFare = 0,               // mínimo a cobrar (ej: 2500)
  serviceSurcharge = 0,      // recargo del servicio (ej: 0.12 para 12%)
  onAccept,
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef(null);

  const kms = useMemo(() => Number(km) || 0, [km]);

  // === Cálculo con breakdown (compat si solo usás ratePerKm) ===
  const calc = useMemo(() => {
    const perKmAmt = Math.max(0, kms) * Math.max(0, ratePerKm);
    const base = Math.max(0, baseRate);
    const subtotal = base + perKmAmt;
    const surchargeAmt = subtotal * Math.max(0, serviceSurcharge);
    const preMin = subtotal + surchargeAmt;
    const minApplied = Math.max(0, minFare) > preMin;
    const total = minApplied ? Math.max(0, minFare) : preMin;

    return {
      price: Math.round(total),
      breakdown: {
        base,
        perKm: Math.round(perKmAmt),
        km: kms,
        ratePerKm: Math.max(0, ratePerKm),
        surchargePct: Math.max(0, serviceSurcharge),
        surchargeAmt: Math.round(surchargeAmt),
        subtotal: Math.round(subtotal),
        minFare: Math.max(0, minFare),
        minApplied,
        total: Math.round(total),
      },
    };
  }, [kms, ratePerKm, baseRate, minFare, serviceSurcharge]);

  const price = calc.price;

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleAccept = () => {
    onAccept?.({
      serviceType,
      origin,
      destination,
      km: kms,
      price,
      breakdown: calc.breakdown,
    });
    setOpen(false);
  };

  // Bloquear scroll del body y cerrar con ESC
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e) => { if (e.key === "Escape") handleClose(); };
      window.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = prev;
        window.removeEventListener("keydown", onKey);
      };
    }
  }, [open]);

  // Enfocar el sheet al abrir para accesibilidad
  useEffect(() => {
    if (open && sheetRef.current) sheetRef.current.focus();
  }, [open]);

  // Helpers de íconos (inline SVG)
  const IconService = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 7h10v10H3zM13 10h4l4 4v3h-8z" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="17.5" cy="17" r="1.5" />
    </svg>
  );
  const IconPin = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
  const IconFlag = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 4v16M6 4h11l-2 4 2 4H6z" />
    </svg>
  );
  const IconRoad = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 22l4-20M18 22l-4-20" />
      <path d="M12 3v3m0 4v4m0 4v3" />
    </svg>
  );
  const IconMoney = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  const IconClose = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );

  return (
    <>
      {/* Trigger */}
      <button type="button" className={styles.calcBtn} onClick={handleOpen}>
        Calcular servicio
      </button>

      {/* Overlay (clic cierra) */}
      {open && <div className={styles.overlay} onClick={handleClose} />}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${open ? styles.open : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Resumen del servicio"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div className={styles.grabber} aria-hidden="true" />
          <div className={styles.headerRow}>
            <div className={styles.serviceBadge}>
              <span className={styles.badgeIcon}>{IconService}</span>
              <span className={styles.badgeText}>
                {serviceType ? serviceType.toUpperCase() : "—"}
              </span>
            </div>
            <button type="button" className={styles.iconBtn} onClick={handleClose} aria-label="Cerrar">
              {IconClose}
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.item}>
            <div className={styles.itemIcon}>{IconPin}</div>
            <div className={styles.itemContent}>
              <div className={styles.itemKey}>Origen</div>
              <div className={styles.itemVal}>{origin || "—"}</div>
            </div>
          </div>

          <div className={styles.item}>
            <div className={styles.itemIcon}>{IconFlag}</div>
            <div className={styles.itemContent}>
              <div className={styles.itemKey}>Destino</div>
              <div className={styles.itemVal}>{destination || "—"}</div>
            </div>
          </div>

          <div className={styles.item}>
            <div className={styles.itemIcon}>{IconRoad}</div>
            <div className={styles.itemContent}>
              <div className={styles.itemKey}>Distancia</div>
              <div className={styles.itemVal}>{kms ? `${kms} km` : "—"}</div>
              <div className={styles.meta}>
                Tarifa base: ${ratePerKm.toLocaleString("es-AR")}/km
              </div>
            </div>
          </div>
        </div>

        <div className={styles.totalBar}>
          <div className={styles.moneyWrap}>
            <span className={styles.moneyIcon}>{IconMoney}</span>
            <span className={styles.totalLabel}>Total</span>
          </div>
          <div className={styles.totalValue}>${price.toLocaleString("es-AR")}</div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={handleClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.acceptBtn}
            onClick={handleAccept}
            disabled={!origin || !destination || !kms}
          >
            Aceptar
          </button>
        </div>
      </div>
    </>
  );
}
