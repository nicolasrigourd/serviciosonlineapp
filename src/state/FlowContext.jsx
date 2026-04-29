import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const FlowContext = createContext(null);

const STORAGE_KEY = "FlowEnviarState";
const PEDIDOS_KEY = "PedidosApp";
const PEDIDO_ACTUAL_KEY = "NuevoPedido";

const initialState = {
  // Dirección y destino
  origin: "",
  originCoords: null,       // { lat, lng, placeId } | null
  destination: "",
  destinationCoords: null,  // { lat, lng, placeId } | null

  // Servicio
  size: "chico",
  serviceType: "simple",    // "simple" | "box" | "bigbox" | ...
  surcharge: 0,

  // Distancia y cotización
  km: 0,
  price: 0,
  breakdown: null,
  quotedAt: null,

  // Contactos y notas
  notesFrom: "",
  notesTo: "",
  contactFrom: "",
  contactTo: "",
  dropoffApt: "",

  // Destinatario
  recipientName: "",
  recipientPhone: "",

  // Contrato operativo básico
  paymentMethod: "cash",           // "cash" | "digital"
  allowsFallbackToLocal: true,
  priority: "normal",              // "normal" | "high"
};

export function FlowProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? { ...initialState, ...JSON.parse(raw) } : initialState;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  function appendPedido(order) {
    try {
      const raw = localStorage.getItem(PEDIDOS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift(order);
      localStorage.setItem(PEDIDOS_KEY, JSON.stringify(arr));
    } catch {}
  }

  function savePedidoActual(order) {
    try {
      localStorage.setItem(PEDIDO_ACTUAL_KEY, JSON.stringify(order));
    } catch {}
  }

  const api = useMemo(() => ({
    state,

    // ========= Setters base =========
    setOrigin: (text, coords = null) =>
      setState((s) => ({
        ...s,
        origin: text,
        originCoords: coords ? normCoords(coords) : s.originCoords,
      })),

    setDestination: (text, coords = null) =>
      setState((s) => ({
        ...s,
        destination: text,
        destinationCoords: coords ? normCoords(coords) : s.destinationCoords,
      })),

    setOriginCoords: (coords) =>
      setState((s) => ({ ...s, originCoords: normCoords(coords) })),

    setDestinationCoords: (coords) =>
      setState((s) => ({ ...s, destinationCoords: normCoords(coords) })),

    setSize: (value) =>
      setState((s) => ({ ...s, size: value })),

    setService: (type, surcharge = 0) =>
      setState((s) => ({
        ...s,
        serviceType: type || "simple",
        surcharge: Number(surcharge) || 0,
      })),

    setKm: (value) =>
      setState((s) => ({ ...s, km: Number(value) || 0 })),

    setPrice: (amount) =>
      setState((s) => ({ ...s, price: Number(amount) || 0 })),

    setQuote: ({ km, total, breakdown }) =>
      setState((s) => ({
        ...s,
        km: Number(km) || 0,
        price: Number(total) || 0,
        breakdown: breakdown || null,
        quotedAt: Date.now(),
      })),

    // ========= Notas / contactos =========
    setNotesFrom: (value) =>
      setState((s) => ({ ...s, notesFrom: value })),

    setNotesTo: (value) =>
      setState((s) => ({ ...s, notesTo: value })),

    setContactFrom: (value) =>
      setState((s) => ({ ...s, contactFrom: value })),

    setContactTo: (value) =>
      setState((s) => ({ ...s, contactTo: value })),

    setDropoffApt: (value) =>
      setState((s) => ({ ...s, dropoffApt: value })),

    // ========= Destinatario =========
    setRecipientName: (value) =>
      setState((s) => ({ ...s, recipientName: value })),

    setRecipientPhone: (value) =>
      setState((s) => ({ ...s, recipientPhone: value })),

    // ========= Contrato operativo =========
    setPaymentMethod: (value) =>
      setState((s) => ({
        ...s,
        paymentMethod: value === "digital" ? "digital" : "cash",
      })),

    setAllowsFallbackToLocal: (value) =>
      setState((s) => ({ ...s, allowsFallbackToLocal: Boolean(value) })),

    setPriority: (value) =>
      setState((s) => ({
        ...s,
        priority: value === "high" ? "high" : "normal",
      })),

    // ========= Compatibilidad con código viejo =========
    setNotes: (value) =>
      setState((s) => ({ ...s, notesTo: value })),

    setContact: (value) =>
      setState((s) => ({ ...s, contactTo: value })),

    // ========= Builder profesional =========
    buildOrder: (sessionUser) => {
      const su = sessionUser || safeReadSessionUser();
      const addresses = Array.isArray(su?.addresses) ? su.addresses : [];
      const def = addresses.find((a) => a?.isDefault) || addresses[0] || null;

      const paymentMethod = state.paymentMethod === "digital" ? "digital" : "cash";
      const requiresCashHandling = paymentMethod === "cash";

      const recipientName = String(state.recipientName || "").trim();
      const recipientPhone = String(state.recipientPhone || "").trim();
      const dropoffApt = String(state.dropoffApt || "").trim();

      const notesFrom = String(state.notesFrom || "").trim();
      const notesTo = String(state.notesTo || "").trim();

      const originCoords = normCoords(state.originCoords);
      const destinationCoords = normCoords(state.destinationCoords);

      const orderId = `ORD-${Date.now()}`;

      return {
        // ========= Identidad / metadata =========
        id: orderId,
        version: 1,
        appSource: "customer_app",
        createdBy: "customer_app",

        createdAt: null, // lo completa server/firestore
        createdAtLocal: new Date().toISOString(),
        lastUpdate: null, // lo completa server/firestore

        // ========= Estados =========
        status: "pendiente",
        serverStatus: "pending_validation",
        assignmentStatus: "unassigned",

        // ========= Naturaleza del pedido =========
        tipoPedido: "online",
        assignmentScope: "online",
        allowsFallbackToLocal: Boolean(state.allowsFallbackToLocal),
        priority: state.priority === "high" ? "high" : "normal",

        // ========= Cliente =========
        customerUid: su?.uid || null,
        userId: su?.uid || null,
        userEmail: su?.email || "",
        userName: su ? `${su.nombre || ""} ${su.apellido || ""}`.trim() : "",
        customerPhone: su?.telefono || "",

        customerDefaultAddress: {
          address: su?.direccion || def?.address || "",
          lat: def?.lat ?? null,
          lng: def?.lng ?? null,
          piso: def?.piso ?? su?.dpto ?? "",
          placeId: def?.placeId || "",
        },

        // ========= Servicio =========
        serviceType: state.serviceType || "simple",
        size: state.size || "chico",
        surcharge: Number(state.surcharge) || 0,

        // ========= Geografía =========
        origin: state.origin || "",
        originCoords: originCoords
          ? { ...originCoords }
          : { lat: null, lng: null, placeId: "" },

        destination: state.destination || "",
        destinationCoords: destinationCoords
          ? { ...destinationCoords }
          : { lat: null, lng: null, placeId: "" },

        dropoffApt,

        km: Number(state.km) || 0,

        // ========= Económico =========
        price: Number(state.price) || 0,
        breakdown: state.breakdown || null,
        quotedAt: state.quotedAt || null,

        paymentMethod,
        requiresCashHandling,

        // ========= Contactos =========
        contactFrom: state.contactFrom || su?.telefono || "",
        contactTo: state.contactTo || recipientPhone || "",

        // ========= Destinatario =========
        recipient: {
          name: recipientName,
          phone: recipientPhone,
          floor: dropoffApt,
        },

        // ========= Notas =========
        notesFrom,
        notesTo,
        notes: {
          origen: notesFrom,
          destino: notesTo,
        },

        // ========= Asignación / tracking =========
        assignedCadeteId: null,
        assignedCadete: null,
        assignedAt: null,

        // ========= Server =========
        serverReviewSummary: null,
      };
    },

    // ========= Guardado local =========
    saveOrder: (order) => {
      if (!order) return;
      appendPedido(order);
      savePedidoActual(order);
    },

    // ========= Reset =========
    reset: () => setState(initialState),
  }), [state]);

  return <FlowContext.Provider value={api}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) {
    throw new Error("useFlow debe usarse dentro de <FlowProvider>");
  }
  return ctx;
}

// ========= Utils =========
function normCoords(coords) {
  if (!coords) return null;

  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  const placeId =
    typeof coords.placeId === "string"
      ? coords.placeId
      : coords.place_id || "";

  if (!isFinite(lat) || !isFinite(lng)) return null;

  return {
    lat,
    lng,
    placeId: placeId || "",
  };
}

function safeReadSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("SessionUser") || "null");
  } catch {
    return null;
  }
}