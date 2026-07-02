import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../../state/FlowContext";
import { clienteDb } from "../../db/clienteDb";
import FlowWizard from "../../components/FlowWizard/FlowWizard";
import StepMapa from "../FlowEnvio/steps/StepMapa";
import StepDatos from "../FlowEnvio/steps/StepDatos";
import StepResumen from "../FlowEnvio/steps/StepResumen";
import AdelantoModal from "../FlowEnvio/steps/AdelantoModal";
import styles from "../FlowEnvio/FlowEnvio.module.css";

const STEP_TITLES = [
  "Nuevo retiro",
  "Nuevo retiro",       // cubierto por el modal
  "Datos del retiro",
  "Resumen del pedido",
];

function toWizardStep(s) {
  if (s <= 1) return 0;
  return s - 1;
}

export default function FlowRetiro() {
  const navigate = useNavigate();
  const { resetDraft, setOperationType, setService, setCashHandlingFeeConfig } = useFlow();
  const [step, setStep] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    resetDraft();
    setOperationType("retiro");
    clienteDb.orderTypes.get("retiro")
      .then((ot) => {
        setService("retiro", ot?.surcharge ?? 0.07);
        setCashHandlingFeeConfig(ot?.money?.cashHandlingFee ?? null);
      })
      .catch(() => setService("simple", 0.07));
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
    { id: "datos",   component: <StepDatos /> },
    { id: "resumen", component: <StepResumen onConfirm={handleComplete} /> },
  ];

  const wizardStep = toWizardStep(step);

  return (
    <div className={styles.screen}>

      <button
        type="button"
        className={styles.backBtn}
        onClick={handleBack}
        aria-label="Volver"
      >
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
          step={wizardStep}
          onNext={handleNext}
          onBack={handleBack}
        />

        {step === 1 && (
          <AdelantoModal onNext={handleNext} />
        )}
      </div>
    </div>
  );
}

const backIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);
