import React, { createContext, useContext, useMemo } from "react";
import styles from "./FlowWizard.module.css";

const WizardCtx = createContext(null);

export function useFlowWizard() {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error("useFlowWizard debe usarse dentro de <FlowWizard>");
  return ctx;
}

export default function FlowWizard({ steps, step, onNext, onBack }) {
  const ctx = useMemo(
    () => ({ step, total: steps.length, next: onNext, back: onBack }),
    [step, steps.length, onNext, onBack]
  );

  return (
    <WizardCtx.Provider value={ctx}>
      <div className={styles.wizard}>
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={styles.slide}
            style={{ "--offset": i - step }}
            {...(i !== step ? { "aria-hidden": "true", inert: "" } : {})}
          >
            {s.component}
          </div>
        ))}
      </div>
    </WizardCtx.Provider>
  );
}
