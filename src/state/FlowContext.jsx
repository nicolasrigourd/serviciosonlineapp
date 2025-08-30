/*
// src/state/FlowContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const FlowContext = createContext(null);
const STORAGE_KEY = "FlowEnviarState";
const PEDIDOS_KEY = "PedidosApp";
const PEDIDO_ACTUAL_KEY = "NuevoPedido";

const initialState = {
  // Dirección y destino (strings + coords opcionales)
  origin: "",
  originCoords: null,       // { lat, lng } | null
  destination: "",
  destinationCoords: null,  // { lat, lng } | null

  // Info paquete/servicio
  size: "chico",
  serviceType: "",          // "simple" | "box" | ...
  surcharge: 0,             // porcentaje o coef (ej 0.12)
  km: 0,
  price: 0,                 // total calculado

  // Notas y contactos
  notesFrom: "",
  notesTo: "",
  contactFrom: "",
  contactTo: "",
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

  // Persistencia en sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // ==== Helpers internos de storage de pedidos ====
  function appendPedido(order) {
    try {
      const raw = localStorage.getItem(PEDIDOS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift(order); // más reciente primero
      localStorage.setItem(PEDIDOS_KEY, JSON.stringify(arr));
    } catch {}
  }

  function savePedidoActual(order) {
    try { localStorage.setItem(PEDIDO_ACTUAL_KEY, JSON.stringify(order)); } catch {}
  }

  // ==== API expuesta al app ====
  const api = useMemo(() => ({
    state,

    // setters existentes (compat)
    setOrigin: (text, coords = null) =>
      setState((s) => ({ ...s, origin: text, originCoords: coords })),
    setDestination: (text, coords = null) =>
      setState((s) => ({ ...s, destination: text, destinationCoords: coords })),
    setSize: (v) => setState((s) => ({ ...s, size: v })),
    setNotes: (v) => setState((s) => ({ ...s, notesTo: v })), // compat con tu viejo "notes"
    setContact: (v) => setState((s) => ({ ...s, contactTo: v })), // compat con tu viejo "contact"
    setKm: (v) => setState((s) => ({ ...s, km: Number(v) || 0 })),

    // nuevos setters más expresivos
    setNotesFrom: (v) => setState((s) => ({ ...s, notesFrom: v })),
    setNotesTo: (v) => setState((s) => ({ ...s, notesTo: v })),
    setContactFrom: (v) => setState((s) => ({ ...s, contactFrom: v })),
    setContactTo: (v) => setState((s) => ({ ...s, contactTo: v })),

    // tipo de servicio y precio
    setService: (type, surcharge = 0) =>
      setState((s) => ({ ...s, serviceType: type, surcharge: Number(surcharge) || 0 })),
    setPrice: (amount) =>
      setState((s) => ({ ...s, price: Number(amount) || 0 })),

    // armar snapshot de pedido listo para guardar/subir
    buildOrder: (sessionUser) => {
      const su = sessionUser || (() => {
        try { return JSON.parse(localStorage.getItem("SessionUser") || "null"); } catch { return null; }
      })();

      return {
        id: `ORD-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userId: su?.id || null,
        userName: su ? `${su.nombre || ""} ${su.apellido || ""}`.trim() : "",
        serviceType: state.serviceType || "simple",
        surcharge: Number(state.surcharge) || 0,
        origin: state.origin,
        originCoords: state.originCoords,
        destination: state.destination,
        destinationCoords: state.destinationCoords,
        km: Number(state.km) || 0,
        price: Number(state.price) || 0,
        size: state.size,
        notesFrom: state.notesFrom || "",
        notesTo: state.notesTo || "",
        contactFrom: state.contactFrom || (su?.telefono || ""),
        contactTo: state.contactTo || "",
        unitPrice: 1000, // mock actual
        status: "pendiente", // 👈 cambio clave: coincide con MisPedidos (EN CURSO)
      };
    },

    // guardar en LocalStorage: historial + pedido actual
    saveOrder: (order) => {
      if (!order) return;
      appendPedido(order);
      savePedidoActual(order);
    },

    // reset del flow (por ejemplo, al finalizar o cancelar)
    reset: () => setState(initialState),
  }), [state]);

  return <FlowContext.Provider value={api}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow debe usarse dentro de <FlowProvider>");
  return ctx;
}
*/
// src/state/FlowContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const FlowContext = createContext(null);
const STORAGE_KEY = "FlowEnviarState";
const PEDIDOS_KEY = "PedidosApp";
const PEDIDO_ACTUAL_KEY = "NuevoPedido";

const initialState = {
  // Dirección y destino (texto + coords enriquecidas)
  origin: "",
  originCoords: null,       // { lat, lng, placeId } | null
  destination: "",
  destinationCoords: null,  // { lat, lng, placeId } | null

  // Info paquete/servicio
  size: "chico",
  serviceType: "",          // "simple" | "box" | "bigbox" | ...
  surcharge: 0,             // porcentaje/coef (ej 0.12)

  // Distancia y precio
  km: 0,
  price: 0,
  breakdown: null,          // { base, perKm, surchargeAmt, minApplied, subtotal, total }
  quotedAt: null,           // timestamp ms

  // Notas y contactos
  notesFrom: "",
  notesTo: "",
  contactFrom: "",
  contactTo: "",
  dropoffApt: "",           // Piso / Dpto del destino
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

  // Persistencia en sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // ==== Helpers internos de storage de pedidos ====
  function appendPedido(order) {
    try {
      const raw = localStorage.getItem(PEDIDOS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift(order); // más reciente primero
      localStorage.setItem(PEDIDOS_KEY, JSON.stringify(arr));
    } catch {}
  }

  function savePedidoActual(order) {
    try { localStorage.setItem(PEDIDO_ACTUAL_KEY, JSON.stringify(order)); } catch {}
  }

  // ==== API expuesta al app ====
  const api = useMemo(() => ({
    state,

    // ---- setters con compatibilidad ----
    setOrigin: (text, coords = null) =>
      setState((s) => ({ ...s, origin: text, originCoords: coords ? normCoords(coords) : s.originCoords })),
    setDestination: (text, coords = null) =>
      setState((s) => ({ ...s, destination: text, destinationCoords: coords ? normCoords(coords) : s.destinationCoords })),
    setSize: (v) => setState((s) => ({ ...s, size: v })),

    // Compatibilidad con código viejo
    setNotes: (v) => setState((s) => ({ ...s, notesTo: v })),        // antes "notes" apuntaba al destino
    setContact: (v) => setState((s) => ({ ...s, contactTo: v })),    // antes "contact" apuntaba al destino
    setKm: (v) => setState((s) => ({ ...s, km: Number(v) || 0 })),

    // ---- nuevos setters expresivos ----
    setOriginCoords: (coords) =>
      setState((s) => ({ ...s, originCoords: normCoords(coords) })),
    setDestinationCoords: (coords) =>
      setState((s) => ({ ...s, destinationCoords: normCoords(coords) })),

    setNotesFrom: (v) => setState((s) => ({ ...s, notesFrom: v })),
    setNotesTo: (v) => setState((s) => ({ ...s, notesTo: v })),
    setContactFrom: (v) => setState((s) => ({ ...s, contactFrom: v })),
    setContactTo: (v) => setState((s) => ({ ...s, contactTo: v })),
    setDropoffApt: (v) => setState((s) => ({ ...s, dropoffApt: v })),

    setService: (type, surcharge = 0) =>
      setState((s) => ({ ...s, serviceType: type, surcharge: Number(surcharge) || 0 })),

    setPrice: (amount) =>
      setState((s) => ({ ...s, price: Number(amount) || 0 })),

    // set de cotización completo (km + price + breakdown)
    setQuote: ({ km, total, breakdown }) =>
      setState((s) => ({
        ...s,
        km: Number(km) || 0,
        price: Number(total) || 0,
        breakdown: breakdown || null,
        quotedAt: Date.now(),
      })),

    // ---- armar snapshot de pedido listo para guardar/subir ----
    buildOrder: (sessionUser) => {
      const su = sessionUser || safeReadSessionUser();
      const addresses = Array.isArray(su?.addresses) ? su.addresses : [];
      const def = addresses.find(a => a?.isDefault) || addresses[0] || null;

      return {
        id: `ORD-${Date.now()}`,
        createdAt: new Date().toISOString(),

        // Relación con el cliente
        userId: su?.uid || null,                           // 👈 corrección: usar uid
        userEmail: su?.email || "",
        userName: su ? `${su.nombre || ""} ${su.apellido || ""}`.trim() : "",

        // Servicio
        serviceType: state.serviceType || "simple",
        surcharge: Number(state.surcharge) || 0,
        size: state.size,

        // Origen / Destino
        origin: state.origin,
        originCoords: state.originCoords,                   // { lat, lng, placeId }
        destination: state.destination,
        destinationCoords: state.destinationCoords,         // { lat, lng, placeId }
        dropoffApt: state.dropoffApt || "",

        // Distancia y cotización
        km: Number(state.km) || 0,
        price: Number(state.price) || 0,
        breakdown: state.breakdown || null,                // detalle de cálculo
        quotedAt: state.quotedAt || null,

        // Contactos y notas
        contactFrom: state.contactFrom || (su?.telefono || ""),
        contactTo: state.contactTo || "",
        notesFrom: state.notesFrom || "",
        notesTo: state.notesTo || "",

        // Snapshot dirección actual del usuario (por si la cambia después)
        customerDefaultAddress: {
          address: su?.direccion || def?.address || "",
          lat: def?.lat ?? null,
          lng: def?.lng ?? null,
          piso: def?.piso ?? su?.dpto ?? "",
          placeId: def?.placeId || "",
        },

        // Estado inicial
        status: "pendiente",
      };
    },

    // guardar en LocalStorage: historial + pedido actual
    saveOrder: (order) => {
      if (!order) return;
      appendPedido(order);
      savePedidoActual(order);
    },

    // reset del flow (por ejemplo, al finalizar o cancelar)
    reset: () => setState(initialState),
  }), [state]);

  return <FlowContext.Provider value={api}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow debe usarse dentro de <FlowProvider>");
  return ctx;
}

// ---- utils ----
function normCoords(c) {
  if (!c) return null;
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  const placeId = typeof c.placeId === "string" ? c.placeId : (c.place_id || "");
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng, placeId: placeId || "" };
}

function safeReadSessionUser() {
  try { return JSON.parse(localStorage.getItem("SessionUser") || "null"); }
  catch { return null; }
}
