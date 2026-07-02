import React from "react";
import { useFlow } from "../../../state/FlowContext";
import styles from "./StepInfoValores.module.css";

const pinIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const moneyIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2.5"/>
    <circle cx="12" cy="12" r="2"/>
    <path d="M6 12h.01M18 12h.01"/>
  </svg>
);

const shieldIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const INFO_ITEMS = [
  {
    icon: pinIcon,
    color: "purple",
    title: "Tu PIN de seguridad",
    getBody: (pin) =>
      `Tu PIN es "${pin}". Compartíselo ahora con quien va a recibir el dinero. ` +
      "El repartidor lo ingresa al hacer la entrega para confirmar que llegó a la persona correcta.",
  },
  {
    icon: moneyIcon,
    color: "amber",
    title: "El dinero debe estar visible",
    getBody: () =>
      "El repartidor tiene que verificar el monto real antes de retirarlo. " +
      "El dinero no puede ir en bolsas cerradas, sobres sellados ni envolturas que impidan su verificación.",
  },
  {
    icon: shieldIcon,
    color: "indigo",
    title: "Ruta protegida por seguridad",
    getBody: () =>
      "Por razones de seguridad, no podrás ver la ubicación del repartidor durante el trayecto. " +
      "Recibirás notificaciones de estado del pedido en cada etapa.",
  },
];

export default function StepInfoValores({ onNext }) {
  const { state } = useFlow();
  const pin = state.securityPin || "····";

  return (
    <div className={styles.overlay}>
      <div className={styles.sheet}>

        <div className={styles.handle} />
        <h2 className={styles.title}>Antes de continuar</h2>
        <p className={styles.subtitle}>Leé estos puntos importantes sobre tu pedido</p>

        <div className={styles.cards}>
          {INFO_ITEMS.map(({ icon, color, title, getBody }) => (
            <div key={title} className={`${styles.card} ${styles[`card_${color}`]}`}>
              <div className={`${styles.cardIcon} ${styles[`icon_${color}`]}`}>
                {icon}
              </div>
              <div className={styles.cardBody}>
                <strong className={styles.cardTitle}>{title}</strong>
                <p className={styles.cardText}>{getBody(pin)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onNext}
          >
            Entendido, ver resumen {arrowIcon}
          </button>
        </div>
      </div>
    </div>
  );
}
