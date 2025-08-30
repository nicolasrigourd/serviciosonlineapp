// src/pages/MisPedidos/MisPedidos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../../state/FlowContext";
import PedidoCard from "../../components/PedidoCard/PedidoCard";
import BottomNav from "../../components/BottomNav/BottomNav";
import {
  loadHistorial, saveHistorial, loadActual,
  clearActual, upsertInHistorial, removeFromHistorial
} from "../../lib/pedidosStore";
import styles from "./MisPedidos.module.css";

// Segments
const SEG_PENDIENTES   = "pendientes";
const SEG_EN_CURSO     = "curso";
const SEG_FINALIZADOS  = "finalizados";
const SEG_CANCELADOS   = "cancelados";

// Helpers
const toArr = (x) => (Array.isArray(x) ? x : []);
const norm  = (s) => String(s || "").toLowerCase();
const byDateDesc = (a, b) => {
  const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return db - da;
};
const uniqById = (arr) => {
  const seen = new Set();
  return arr.filter(it => {
    const id = it?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export default function MisPedidos() {
  const navigate = useNavigate();

  const flow = (() => {
    try { return useFlow(); } catch { return null; }
  })();

  // Dejamos por defecto "pendientes" para que el último pedido recién creado se vea ahí
  const [seg, setSeg] = useState(SEG_PENDIENTES);
  const [historial, setHistorial] = useState([]);
  const [actual, setActual] = useState(null);

  useEffect(() => {
    setHistorial(loadHistorial());
    setActual(loadActual());
  }, []);

  // Conjuntos por estado (normalizados)
  const S_PEND   = new Set(["pendiente"]);
  const S_CURSO  = new Set(["asignado", "en_camino", "en curso", "encurso"]);
  const S_FIN    = new Set(["entregado", "completado", "finalizado"]);
  const S_CAN    = new Set(["cancelado", "rechazado"]);

  // Listas segmentadas
  const pendientes = useMemo(() => {
    const base = [
      ...(actual && S_PEND.has(norm(actual.status)) ? [actual] : []),
      ...toArr(historial).filter(p => S_PEND.has(norm(p?.status))),
    ];
    return uniqById(base).sort(byDateDesc);
  }, [actual, historial]);

  const enCurso = useMemo(() => {
    const base = [
      ...(actual && S_CURSO.has(norm(actual.status)) ? [actual] : []),
      ...toArr(historial).filter(p => S_CURSO.has(norm(p?.status))),
    ];
    return uniqById(base).sort(byDateDesc);
  }, [actual, historial]);

  const finalizados = useMemo(() => {
    return toArr(historial)
      .filter(p => S_FIN.has(norm(p?.status)))
      .sort(byDateDesc);
  }, [historial]);

  const cancelados = useMemo(() => {
    return toArr(historial)
      .filter(p => S_CAN.has(norm(p?.status)))
      .sort(byDateDesc);
  }, [historial]);

  const currentList =
    seg === SEG_PENDIENTES  ? pendientes  :
    seg === SEG_EN_CURSO    ? enCurso     :
    seg === SEG_FINALIZADOS ? finalizados :
    cancelados;

  const handleVer = (id) => {
    const isActual = actual?.id === id;
    if (isActual) navigate("/flow/checkout");
    else alert(`Detalle de ${id} (pendiente de implementar modal/detalle).`);
  };

  const handleCancelar = (id) => {
    if (!confirm("¿Seguro que querés cancelar este pedido?")) return;
    if (actual?.id === id) {
      const updated = { ...actual, status: "cancelado" };
      upsertInHistorial(updated);
      clearActual();
      setActual(null);
      setHistorial(loadHistorial());
      return;
    }
    const old = historial.find(p => p.id === id);
    if (old) {
      upsertInHistorial({ ...old, status: "cancelado" });
      setHistorial(loadHistorial());
    }
  };

  const handleEliminar = (id) => {
    if (!confirm("¿Eliminar este pedido del historial?")) return;
    setHistorial(removeFromHistorial(id));
  };

  const handleRepetir = (pedido) => {
    try {
      flow?.setOrigin?.(pedido.origin || "");
      flow?.setDestination?.(pedido.destination || "");
      flow?.setServiceType?.(pedido.serviceType || "");
      flow?.setNotes?.("");
      flow?.setKm?.(pedido.km || 0);
    } catch {}
    navigate("/flow/enviar");
  };

  const countPend = pendientes.length;
  const countCurso = enCurso.length;
  const countFin = finalizados.length;
  const countCan = cancelados.length;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mis pedidos</h1>
        <div className={styles.tabs} role="tablist">
          <button
            className={`${styles.tab} ${seg === SEG_PENDIENTES ? styles.tabActive : ""}`}
            onClick={() => setSeg(SEG_PENDIENTES)}
          >
            Pendientes <span className={styles.ct}>{countPend}</span>
          </button>
          <button
            className={`${styles.tab} ${seg === SEG_EN_CURSO ? styles.tabActive : ""}`}
            onClick={() => setSeg(SEG_EN_CURSO)}
          >
            En curso <span className={styles.ct}>{countCurso}</span>
          </button>
          <button
            className={`${styles.tab} ${seg === SEG_FINALIZADOS ? styles.tabActive : ""}`}
            onClick={() => setSeg(SEG_FINALIZADOS)}
          >
            Finalizados <span className={styles.ct}>{countFin}</span>
          </button>
          <button
            className={`${styles.tab} ${seg === SEG_CANCELADOS ? styles.tabActive : ""}`}
            onClick={() => setSeg(SEG_CANCELADOS)}
          >
            Cancelados <span className={styles.ct}>{countCan}</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {currentList.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyCard}>
              <h2 className={styles.emptyTitle}>
                {seg === SEG_PENDIENTES  ? "No hay pedidos pendientes" :
                 seg === SEG_EN_CURSO    ? "Sin pedidos en curso" :
                 seg === SEG_FINALIZADOS ? "Aún no tenés pedidos finalizados" :
                 "No hay cancelados"}
              </h2>
              <p className={styles.emptyText}>
                Creá un nuevo envío desde la pantalla principal.
              </p>
              <button className={styles.primaryBtn} onClick={() => navigate("/home")}>
                Ir al inicio
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {currentList.map((p) => (
              <PedidoCard
                key={p.id}
                pedido={p}
                isCurrent={p.id === actual?.id} // por si tu card lo usa
                onVer={handleVer}
                onCancelar={handleCancelar}
                onRepetir={handleRepetir}
                onEliminar={handleEliminar}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
