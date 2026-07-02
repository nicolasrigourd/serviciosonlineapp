import React, { useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useFlowWizard } from "../../../components/FlowWizard/FlowWizard";
import styles from "./StepListaCompras.module.css";

const MAX_ITEMS = 10;

function onlyDigits(v) { return String(v || "").replace(/\D/g, ""); }

export default function StepListaCompras() {
  const { state, setShoppingList, setShoppingBudget } = useFlow();
  const { next } = useFlowWizard();

  const [inputText, setInputText]   = useState("");
  const [budget, setBudget]         = useState(
    state.shoppingBudget > 0 ? String(state.shoppingBudget) : ""
  );

  const list    = state.shoppingList || [];
  const isFull  = list.length >= MAX_ITEMS;
  const budgetN = Number(onlyDigits(budget)) || 0;
  const canAdd  = inputText.trim().length > 0 && !isFull;
  const canNext = list.length > 0 && budgetN > 0;

  function handleAdd() {
    const item = inputText.trim();
    if (!item || isFull) return;
    setShoppingList([...list, item]);
    setInputText("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
  }

  function handleRemove(i) {
    const next = list.filter((_, idx) => idx !== i);
    setShoppingList(next);
  }

  function handleBudget(v) {
    const clean = onlyDigits(v);
    setBudget(clean);
    setShoppingBudget(Number(clean) || 0);
  }

  function handleNext() {
    if (!canNext) return;
    setShoppingBudget(budgetN);
    next();
  }

  return (
    <div className={styles.step}>
      <div className={styles.content}>

        {/* ── Input agregar ítem ────────────────────────────────── */}
        <div className={styles.addRow}>
          <input
            type="text"
            className={styles.addInput}
            placeholder="Ej: 1 litro de leche entera"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={80}
            disabled={isFull}
          />
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAdd}
            disabled={!canAdd}
          >
            Agregar
          </button>
        </div>

        {/* ── Lista de ítems ────────────────────────────────────── */}
        <div>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Lista</span>
            <span className={`${styles.counter} ${isFull ? styles.counterFull : ""}`}>
              {list.length}/{MAX_ITEMS}
            </span>
          </div>

          <div className={styles.list}>
            {list.length === 0 && (
              <p className={styles.emptyHint}>Agregá los productos que necesitás comprar</p>
            )}
            {list.map((item, i) => (
              <div key={i} className={styles.item}>
                <span className={styles.itemIcon}>🛒</span>
                <span className={styles.itemText}>{item}</span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => handleRemove(i)}
                  aria-label="Eliminar ítem"
                >
                  {trashIcon}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Presupuesto ───────────────────────────────────────── */}
        <div className={styles.budgetBlock}>
          <p className={styles.budgetLabel}>¿Cuánto dinero necesita el repartidor?</p>
          <div className={styles.budgetRow}>
            <span className={styles.budgetPrefix}>$</span>
            <input
              type="tel"
              inputMode="numeric"
              className={styles.budgetInput}
              placeholder="0"
              value={budget}
              onChange={(e) => handleBudget(e.target.value)}
            />
          </div>
          <p className={styles.budgetNote}>
            Estimá el total de la compra. El repartidor usará este monto y te rinde cuentas al entregar.
          </p>
        </div>

      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={!canNext}
        >
          Continuar {arrowIcon}
        </button>
      </div>
    </div>
  );
}

const trashIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
