import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../../state/FlowContext";
import { clienteDb } from "../../db/clienteDb";
import FlowWizard from "../../components/FlowWizard/FlowWizard";
import StepMapa from "../FlowEnvio/steps/StepMapa";
import StepDatos from "../FlowEnvio/steps/StepDatos";
import StepResumen from "../FlowEnvio/steps/StepResumen";
import AdelantoModal from "../FlowEnvio/steps/AdelantoModal";
import DeliveryChoiceModal from "./DeliveryChoiceModal";
import styles from "../FlowEnvio/FlowEnvio.module.css";

// step 0 = elección (DeliveryChoiceModal)
// step 1 = mapa
// step 2 = modal adelanto (overlay sobre mapa)
// step 3 = datos
// step 4 = resumen
const STEP_TITLES = ["", "Delivery", "Delivery", "Datos del pedido", "Resumen del pedido"];

function toWizardStep(s) {
  if (s <= 2) return 0;   // mapa
  return s - 2;           // 3→1 (datos), 4→2 (resumen)
}

export default function FlowDelivery() {
  const navigate = useNavigate();
  const { resetDraft, setOperationType, setService, setCashHandlingFeeConfig, setServiceCategory } = useFlow();
  const [step, setStep] = useState(0);
  const initialized = useRef(false);

  // Inicializar solo el draft; operationType se fija cuando el usuario elige
  if (!initialized.current) {
    initialized.current = true;
    resetDraft();
  }

  const handleChoose = useCallback((mode) => {
    resetDraft();
    setOperationType(mode);
    setServiceCategory("delivery");
    clienteDb.orderTypes.get("delivery")
      .then((ot) => {
        setService("delivery", ot?.surcharge ?? 0);
        setCashHandlingFeeConfig(ot?.money?.cashHandlingFee ?? null);
      })
      .catch(() => setService("delivery", 0));
    setStep(1);
  }, [resetDraft, setOperationType, setServiceCategory, setService, setCashHandlingFeeConfig]);

  const handleNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, 4));
  }, []);

  const handleBack = useCallback(() => {
    if (step === 0) { navigate(-1); return; }
    setStep((s) => s - 1);
  }, [step, navigate]);

  const handleComplete = useCallback((orderId) => {
    navigate(`/flow/checkout?orderId=${orderId}`);
  }, [navigate]);

  // Paso 0: pantalla de elección full-screen
  if (step === 0) {
    return <DeliveryChoiceModal onChoose={handleChoose} onBack={() => navigate(-1)} />;
  }

  const wizardSteps = [
    { id: "mapa",    component: <StepMapa /> },
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
          <div className={styles.progress} role="progressbar" aria-valuenow={step} aria-valuemax={4}>
            {[1, 2, 3, 4].map((i) => (
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
          step={toWizardStep(step)}
          onNext={handleNext}
          onBack={handleBack}
        />

        {step === 2 && <AdelantoModal onNext={handleNext} />}
      </div>
    </div>
  );
}

const backIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);
