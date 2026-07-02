import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../../state/FlowContext";
import { clienteDb } from "../../db/clienteDb";
import FlowWizard from "../../components/FlowWizard/FlowWizard";
import StepMapa from "../FlowEnvio/steps/StepMapa";
import StepDatos from "../FlowEnvio/steps/StepDatos";
import StepResumen from "../FlowEnvio/steps/StepResumen";
import StepMontoValores from "./steps/StepMontoValores";
import StepPinValores from "./steps/StepPinValores";
import StepInfoValores from "./steps/StepInfoValores";
import ValoresChoiceModal from "./ValoresChoiceModal";
import styles from "../FlowEnvio/FlowEnvio.module.css";

// step 0 → choice modal
// step 1 → monto
// step 2 → mapa
// step 3 → pin
// step 4 → datos
// step 5 → info modal overlay (sobre datos)
// step 6 → resumen
const TOTAL_STEPS = 7;

const STEP_TITLES = [
  "Nuevo envío de valores",   // 0 — cubierto por modal
  "Monto a transportar",      // 1
  "Nuevo envío de valores",   // 2 — mapa
  "PIN de seguridad",         // 3
  "Datos del pedido",         // 4
  "Información importante",   // 5 — cubierto por overlay
  "Resumen del pedido",       // 6
];

function toWizardStep(s) {
  if (s <= 1) return 0;      // choice modal o monto → wizard índice 0 (monto)
  if (s <= 4) return s - 1;  // mapa→1, pin→2, datos→3
  if (s === 5) return 3;     // info overlay → sigue mostrando datos atrás
  return 4;                  // resumen → wizard índice 4
}

export default function FlowValores() {
  const navigate = useNavigate();
  const {
    resetDraft, setOperationType, setValoresMode,
    setService, setCashHandlingFeeConfig,
  } = useFlow();
  const [step, setStep] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    resetDraft();
    setOperationType("valores");
    clienteDb.orderTypes.get("valores")
      .then((ot) => {
        setService("valores", ot?.surcharge ?? 0);
        setCashHandlingFeeConfig(ot?.money?.cashHandlingFee ?? null);
      })
      .catch(() => setService("valores", 0));
  }, []);

  function handleChoose(mode) {
    setValoresMode(mode);
    setStep(1);
  }

  const handleNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const handleBack = useCallback(() => {
    if (step === 0) { navigate(-1); return; }
    if (step === 1) { setStep(0); return; }
    setStep((s) => s - 1);
  }, [step, navigate]);

  const handleComplete = useCallback((orderId) => {
    navigate(`/flow/checkout?orderId=${orderId}`);
  }, [navigate]);

  const wizardSteps = [
    { id: "monto",   component: <StepMontoValores /> },
    { id: "mapa",    component: <StepMapa /> },
    { id: "pin",     component: <StepPinValores /> },
    { id: "datos",   component: <StepDatos /> },
    { id: "resumen", component: <StepResumen onConfirm={handleComplete} /> },
  ];

  const wizardStep = toWizardStep(step);

  // Dots: 5 visibles (excluye el choice modal)
  const dotStep = Math.max(0, step - 1);
  const DOT_COUNT = 5;

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
          <div className={styles.progress} role="progressbar" aria-valuenow={dotStep + 1} aria-valuemax={DOT_COUNT}>
            {Array.from({ length: DOT_COUNT }, (_, i) => (
              <div
                key={i}
                className={`${styles.dot} ${i < dotStep ? styles.dotDone : i === dotStep ? styles.dotActive : ""}`}
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

        {/* Info modal overlay — aparece sobre datos */}
        {step === 5 && (
          <StepInfoValores onNext={handleNext} />
        )}

      </div>

      {/* Choice modal — aparece sobre todo */}
      {step === 0 && (
        <ValoresChoiceModal
          onChoose={handleChoose}
          onClose={() => navigate(-1)}
        />
      )}

    </div>
  );
}

const backIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);
