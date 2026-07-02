/**
 * Calcula el adicional por manejo de efectivo, tal como lo hace el nodo-operador
 * y el panel admin. La config viene de orderTypes/{id}.money.cashHandlingFee.
 *
 *   type: "fixed"     → cargo fijo (charge) sin importar el monto
 *   type: otro        → Math.ceil(monto / every) * charge
 *                       Ej: $200 por cada $1000 transportados
 */
export function calcularAdicionalManejo(monto, cashHandlingFee) {
  if (!cashHandlingFee?.active) return 0;
  const m = Number(monto) || 0;
  if (m <= 0) return 0;
  if (cashHandlingFee.type === "fixed") return Number(cashHandlingFee.charge) || 0;
  const every  = Number(cashHandlingFee.every)  || 0;
  const charge = Number(cashHandlingFee.charge) || 0;
  if (every <= 0) return 0;
  return Math.ceil(m / every) * charge;
}

/** Devuelve una descripción legible del cargo (para mostrar al usuario). */
export function describeCashHandlingFee(cashHandlingFee, fmtARS) {
  if (!cashHandlingFee?.active) return null;
  if (cashHandlingFee.type === "fixed") {
    return `Cargo fijo por manejo de efectivo: ${fmtARS(cashHandlingFee.charge)}`;
  }
  return `${fmtARS(cashHandlingFee.charge)} por cada ${fmtARS(cashHandlingFee.every)} transportados`;
}
