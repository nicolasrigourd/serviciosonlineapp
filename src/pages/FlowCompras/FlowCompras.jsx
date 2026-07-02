import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../../state/FlowContext";
import { clienteDb } from "../../db/clienteDb";
import FlowWizard from "../../components/FlowWizard/FlowWizard";
import StepMapa from "../FlowEnvio/steps/StepMapa";
import StepListaCompras from "./steps/StepListaCompras";
import StepDatos from "../FlowEnvio/steps/StepDatos";
import StepResumen from "../FlowEnvio/steps/StepResumen";
import styles from "../FlowEnvio/FlowEnvio.module.css";

// step 0 = mapa (dónde compramos → dónde entregamos)
// step 1 = lista de compras + presupuesto
// step 2 = datos del destinatario
// step 3 = resumen + confirmar
const STEP_TITLES = [
  "Nueva compra",
  "Lista de compras",
  "Datos de entrega",
  "Resumen del pedido",
];

export default function FlowCompras() {
  const navigate = useNavigate();
  const { resetDraft, setOperationType, setService, setCashHandlingFeeConfig } = useFlow();
  const [step, setStep] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    resetDraft();
    setOperationType("compras");
    clienteDb.orderTypes.get("compras")
      .then((ot) => {
        setService("compras", ot?.surcharge ?? 0);
        setCashHandlingFeeConfig(ot?.money?.cashHandlingFee ?? null);
      })
      .catch(() => setService("compras", 0));
  }, []);

  const handleNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, 3));
  }, []);

  const handleBack = useCallback(() => {
    if (step === 0) { navigate(-1); return; }
    setStep((s) => s - 1);
  }, [step, navigate]);

  const handleComplete = useCallback((orderId) => {
    navigate(`/flow/checkout?orderId=${orderId}`);
  }, [navigate]);

  const wizardSteps = [
    { id: "mapa",    component: <StepMapa /> },
    { id: "lista",   component: <StepListaCompras /> },
    { id: "datos",   component: <StepDatos /> },
    { id: "resumen", component: <StepResumen onConfirm={handleComplete} /> },
  ];

  return (
    <div className={styles.screen}>

      <button type="button" className={styles.backBtn} onClick={handleBack} aria-label="Volver">
        {backIcon}
      </button>

      <div className={styles.sheet}>

        <div className={`${styles.sheetHeader} ${styles.sheetHeaderMap}`}>
          <div className={styles.progress} role="progressbar" aria-valuenow={step + 1} aria-valuemax={4}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`${styles.dot} ${i < step ? styles.dotDone : i === step ? styles.dotActive : ""}`}
              />
            ))}
          </div>
          <span className={styles.stepTitle}>{STEP_TITLES[step]}</span>
        </div>

        <FlowWizard
          steps={wizardSteps}
          step={step}
          onNext={handleNext}
          onBack={handleBack}
        />

      </div>
    </div>
  );
}

const backIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);
