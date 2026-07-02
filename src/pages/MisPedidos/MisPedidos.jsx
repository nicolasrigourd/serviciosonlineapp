// src/pages/MisPedidos/MisPedidos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../../state/FlowContext";
import PedidoCard from "../../components/PedidoCard/PedidoCard";
import BottomNav from "../../components/BottomNav/BottomNav";
import { loadAllOrdersDb, cancelOrderDb, patchOrderDb } from "../../lib/pedidosStore";
import { clienteDb } from "../../db/clienteDb";
import styles from "./MisPedidos.module.css";

const SEG_PENDIENTES = "pendientes";
const SEG_EN_CURSO = "curso";
const SEG_FINALIZADOS = "finalizados";
const SEG_CANCELADOS = "cancelados";

const toArr = (x) => (Array.isArray(x) ? x : []);
const norm = (s) => String(s || "").toLowerCase();

const byDateDesc = (a, b) => {
  const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return db - da;
};

const uniqById = (arr) => {
  const seen = new Set();

  return arr.filter((item) => {
    const id = item?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

function getSegmentTitle(seg) {
  if (seg === SEG_PENDIENTES) return "No hay pedidos pendientes";
  if (seg === SEG_EN_CURSO) return "Sin pedidos en curso";
  if (seg === SEG_FINALIZADOS) return "Aún no tenés pedidos finalizados";
  return "No hay pedidos cancelados";
}

function getSegmentDescription(seg) {
  if (seg === SEG_PENDIENTES) {
    return "Cuando crees un envío nuevo, aparecerá en esta sección.";
  }

  if (seg === SEG_EN_CURSO) {
    return "Los pedidos asignados o en viaje se mostrarán acá.";
  }

  if (seg === SEG_FINALIZADOS) {
    return "Los pedidos entregados quedarán guardados en tu historial.";
  }

  return "Los pedidos cancelados aparecerán en esta sección.";
}

export default function MisPedidos() {
  const navigate = useNavigate();

  const flow = (() => {
    try {
      return useFlow();
    } catch {
      return null;
    }
  })();

  const [seg, setSeg] = useState(SEG_PENDIENTES);
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    loadAllOrdersDb().then(setTodos);
  }, []);

  const S_PEND = new Set(["pending", "pendiente"]);
  const S_CURSO = new Set([
    "assigned", "asignado",
    "offering", "ofertando", "ofertado",
    "en_camino", "en_camino_origen", "en_camino_destino",
    "en curso", "encurso", "en_curso",
    "enviado_local", "asignado_online", "retirado",
  ]);
  const S_FIN = new Set(["completed", "delivered", "entregado", "completado", "finalizado"]);
  const S_CAN = new Set(["cancelled", "canceled", "cancelado", "rechazado"]);

  const pendientes = useMemo(() =>
    uniqById(toArr(todos).filter((p) => S_PEND.has(norm(p?.status)))).sort(byDateDesc),
  [todos]);

  const enCurso = useMemo(() =>
    uniqById(toArr(todos).filter((p) => S_CURSO.has(norm(p?.status)))).sort(byDateDesc),
  [todos]);

  const finalizados = useMemo(() =>
    toArr(todos).filter((p) => S_FIN.has(norm(p?.status))).sort(byDateDesc),
  [todos]);

  const cancelados = useMemo(() =>
    toArr(todos).filter((p) => S_CAN.has(norm(p?.status))).sort(byDateDesc),
  [todos]);

  const currentList =
    seg === SEG_PENDIENTES
      ? pendientes
      : seg === SEG_EN_CURSO
        ? enCurso
        : seg === SEG_FINALIZADOS
          ? finalizados
          : cancelados;

  const totalPedidos =
    pendientes.length + enCurso.length + finalizados.length + cancelados.length;

  const reloadOrders = () => loadAllOrdersDb().then(setTodos);

  const handleVer = (id) => {
    navigate(`/flow/checkout?orderId=${id}`);
  };

  const handleCancelar = async (id) => {
    if (!confirm("¿Seguro que querés cancelar este pedido?")) return;
    await cancelOrderDb(id).catch(() => {});
    reloadOrders();
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Eliminar este pedido del historial?")) return;
    await clienteDb.orders.delete(id).catch(() => {});
    reloadOrders();
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

  const segments = [
    {
      key: SEG_PENDIENTES,
      label: "Pendientes",
      count: pendientes.length,
    },
    {
      key: SEG_EN_CURSO,
      label: "En curso",
      count: enCurso.length,
    },
    {
      key: SEG_FINALIZADOS,
      label: "Finalizados",
      count: finalizados.length,
    },
    {
      key: SEG_CANCELADOS,
      label: "Cancelados",
      count: cancelados.length,
    },
  ];

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.kicker}>Historial</span>
            <h1 className={styles.title}>Mis pedidos</h1>
            <p className={styles.subtitle}>
              Revisá tus envíos pendientes, en curso y finalizados.
            </p>
          </div>

          <div className={styles.counterBox}>
            <strong>{totalPedidos}</strong>
            <span>Total</span>
          </div>
        </div>

        <div className={styles.tabsWrap}>
          <div className={styles.tabs} role="tablist" aria-label="Estados de pedidos">
            {segments.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={seg === item.key}
                className={`${styles.tab} ${
                  seg === item.key ? styles.tabActive : ""
                }`}
                onClick={() => setSeg(item.key)}
              >
                <span>{item.label}</span>
                <em>{item.count}</em>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {currentList.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyCard}>
              <div className={styles.emptyIcon}>{emptyIcon}</div>

              <h2 className={styles.emptyTitle}>{getSegmentTitle(seg)}</h2>

              <p className={styles.emptyText}>{getSegmentDescription(seg)}</p>

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => navigate("/home")}
              >
                Ir al inicio
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {currentList.map((pedido) => (
              <PedidoCard
                key={pedido.orderId || pedido.id}
                pedido={pedido}
                isCurrent={S_CURSO.has(norm(pedido?.status)) || S_PEND.has(norm(pedido?.status))}
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

const emptyIcon = (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 7h16" />
    <path d="M6 7l1.2 12h9.6L18 7" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);