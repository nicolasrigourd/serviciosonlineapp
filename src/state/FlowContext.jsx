// src/state/FlowContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const FlowContext = createContext(null);

const STORAGE_KEY = "FlowEnviarState";
const PEDIDOS_KEY = "PedidosApp";
const PEDIDO_ACTUAL_KEY = "NuevoPedido";

const initialState = {
  // ========= Geografía =========
  origin: "",
  originCoords: null,
  destination: "",
  destinationCoords: null,

  // ========= Tipo operativo =========
  operationType: "", // "envio" | "retiro"

  // ========= Servicio =========
  size: "chico",
  serviceType: "simple",
  surcharge: 0,

  // ========= Distancia y cotización =========
  km: 0,
  price: 0,
  breakdown: null,
  quotedAt: null,

  // ========= Punto de retiro / pickup =========
  contactFromName: "",
  contactFrom: "",
  pickupApt: "",
  pickupReference: "",
  notesFrom: "",

  // ========= Punto de entrega / dropoff =========
  recipientName: "",
  recipientPhone: "",
  contactTo: "",
  dropoffApt: "",
  dropoffReference: "",
  notesTo: "",

  // ========= Compatibilidad vieja =========
  legacyNotes: "",

  // ========= Pago y contrato operativo =========
  paymentMethod: "", // "" | "cash" | "mercadopago"
  allowsFallbackToLocal: true,
  priority: "normal",
};

export function FlowProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? { ...initialState, ...JSON.parse(raw) } : { ...initialState };
    } catch {
      return { ...initialState };
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

  const api = useMemo(
    () => ({
      state,

      // ========= Setters de geografía =========
      setOrigin: (text, coords = undefined) =>
        setState((s) => ({
          ...s,
          origin: text,
          originCoords:
            coords === undefined
              ? s.originCoords
              : coords
                ? normCoords(coords)
                : null,
        })),

      setDestination: (text, coords = undefined) =>
        setState((s) => ({
          ...s,
          destination: text,
          destinationCoords:
            coords === undefined
              ? s.destinationCoords
              : coords
                ? normCoords(coords)
                : null,
        })),

      setOriginCoords: (coords) =>
        setState((s) => ({
          ...s,
          originCoords: normCoords(coords),
        })),

      setDestinationCoords: (coords) =>
        setState((s) => ({
          ...s,
          destinationCoords: normCoords(coords),
        })),

      // ========= Operación / servicio =========
      setOperationType: (value) =>
        setState((s) => ({
          ...s,
          operationType:
            value === "retiro" ? "retiro" : value === "envio" ? "envio" : "",
        })),

      setSize: (value) =>
        setState((s) => ({
          ...s,
          size: value || "chico",
        })),

      setService: (type, surcharge = 0) =>
        setState((s) => ({
          ...s,
          serviceType: type || "simple",
          surcharge: Number(surcharge) || 0,
        })),

      // ========= Cotización =========
      setKm: (value) =>
        setState((s) => ({
          ...s,
          km: Number(value) || 0,
        })),

      setPrice: (amount) =>
        setState((s) => ({
          ...s,
          price: Number(amount) || 0,
        })),

      setQuote: (quote) =>
        setState((s) => {
          if (!quote) {
            return {
              ...s,
              km: 0,
              price: 0,
              breakdown: null,
              quotedAt: null,
            };
          }

          return {
            ...s,
            km: Number(quote.km) || 0,
            price: Number(quote.total) || 0,
            breakdown: quote.breakdown || null,
            quotedAt: Date.now(),
          };
        }),

      // ========= Punto de retiro / pickup =========
      setContactFromName: (value) =>
        setState((s) => ({
          ...s,
          contactFromName: value || "",
        })),

      setContactFrom: (value) =>
        setState((s) => ({
          ...s,
          contactFrom: value || "",
        })),

      setPickupApt: (value) =>
        setState((s) => ({
          ...s,
          pickupApt: value || "",
          pickupReference: value || "",
        })),

      setPickupReference: (value) =>
        setState((s) => ({
          ...s,
          pickupReference: value || "",
          pickupApt: value || "",
        })),

      setNotesFrom: (value) =>
        setState((s) => ({
          ...s,
          notesFrom: value || "",
        })),

      // ========= Punto de entrega / dropoff =========
      setRecipientName: (value) =>
        setState((s) => ({
          ...s,
          recipientName: value || "",
        })),

      setRecipientPhone: (value) =>
        setState((s) => ({
          ...s,
          recipientPhone: value || "",
        })),

      setContactTo: (value) =>
        setState((s) => ({
          ...s,
          contactTo: value || "",
        })),

      setDropoffApt: (value) =>
        setState((s) => ({
          ...s,
          dropoffApt: value || "",
          dropoffReference: value || "",
        })),

      setDropoffReference: (value) =>
        setState((s) => ({
          ...s,
          dropoffReference: value || "",
          dropoffApt: value || "",
        })),

      setNotesTo: (value) =>
        setState((s) => ({
          ...s,
          notesTo: value || "",
        })),

      // ========= Pago =========
      setPaymentMethod: (value) =>
        setState((s) => ({
          ...s,
          paymentMethod:
            value === "cash" || value === "mercadopago" ? value : "",
        })),

      setAllowsFallbackToLocal: (value) =>
        setState((s) => ({
          ...s,
          allowsFallbackToLocal: Boolean(value),
        })),

      setPriority: (value) =>
        setState((s) => ({
          ...s,
          priority: value === "high" ? "high" : "normal",
        })),

      // ========= Compatibilidad con código viejo =========
      // Importante: setNotes ya NO pisa notesTo.
      // Antes mezclaba ORIGEN/DESTINO dentro de notesTo y generaba bugs.
      setNotes: (value) =>
        setState((s) => ({
          ...s,
          legacyNotes: value || "",
        })),

      setContact: (value) =>
        setState((s) => ({
          ...s,
          contactTo: value || "",
        })),

      // ========= Builder profesional =========
      buildOrder: (sessionUser) => {
        const su = sessionUser || safeReadSessionUser();

        const addresses = Array.isArray(su?.addresses) ? su.addresses : [];
        const def = addresses.find((a) => a?.isDefault) || addresses[0] || null;

        const operationType =
          state.operationType || safeReadOperationType() || "";

        const paymentMethod =
          state.paymentMethod === "mercadopago"
            ? "mercadopago"
            : state.paymentMethod === "cash"
              ? "cash"
              : "";

        const paymentLabel =
          paymentMethod === "cash"
            ? "Efectivo"
            : paymentMethod === "mercadopago"
              ? "MercadoPago"
              : "";

        const paymentStatus =
          paymentMethod === "cash"
            ? "pending_cash"
            : paymentMethod === "mercadopago"
              ? "pending_digital"
              : "";

        const requiresCashHandling = paymentMethod === "cash";
        const requiresMercadoPago = paymentMethod === "mercadopago";

        const originCoords = normCoords(state.originCoords);
        const destinationCoords = normCoords(state.destinationCoords);

        const contactFromName = String(state.contactFromName || "").trim();
        const contactFrom = String(state.contactFrom || "").trim();

        const recipientName = String(state.recipientName || "").trim();
        const recipientPhone = String(
          state.recipientPhone || state.contactTo || ""
        ).trim();

        const pickupApt = String(
          state.pickupApt || state.pickupReference || ""
        ).trim();

        const dropoffApt = String(
          state.dropoffApt || state.dropoffReference || ""
        ).trim();

        const notesFrom = String(state.notesFrom || "").trim();
        const notesTo = String(state.notesTo || "").trim();

        const price = Number(state.price) || 0;
        const orderId = `ORD-${Date.now()}`;

        const pickup = {
          address: state.origin || "",
          coords: originCoords ? { ...originCoords } : null,
          contactName: contactFromName,
          contactPhone: contactFrom,
          floorOrReference: pickupApt,
          notes: notesFrom,
        };

        const dropoff = {
          address: state.destination || "",
          coords: destinationCoords ? { ...destinationCoords } : null,
          contactName: recipientName,
          contactPhone: recipientPhone,
          floorOrReference: dropoffApt,
          notes: notesTo,
        };

        return {
          // ========= Identidad / metadata =========
          id: orderId,
          version: 2,
          appSource: "customer_app",
          createdBy: "customer_app",

          createdAt: null,
          createdAtLocal: new Date().toISOString(),
          lastUpdate: null,

          // ========= Estados =========
          status: "pendiente",
          serverStatus: "pending_validation",
          assignmentStatus: "unassigned",

          // ========= Naturaleza del pedido =========
          tipoPedido: "online",
          operationType,
          assignmentScope: "online",
          allowsFallbackToLocal: Boolean(state.allowsFallbackToLocal),
          priority: state.priority === "high" ? "high" : "normal",

          // ========= Cliente =========
          customerUid: su?.uid || null,
          userId: su?.uid || null,
          userEmail: su?.email || "",
          userName: su
            ? `${su.nombre || ""} ${su.apellido || ""}`.trim()
            : "",
          customerPhone: su?.telefono || "",

          customerDefaultAddress: {
            address: su?.direccion || def?.address || "",
            lat: def?.lat ?? null,
            lng: def?.lng ?? null,
            piso: def?.piso ?? su?.dpto ?? "",
            referencia: def?.referencia || def?.descripcion || "",
            placeId: def?.placeId || "",
          },

          // ========= Servicio =========
          serviceType: state.serviceType || "simple",
          size: state.size || "chico",
          surcharge: Number(state.surcharge) || 0,

          // ========= Geografía legacy =========
          origin: state.origin || "",
          originCoords: originCoords
            ? { ...originCoords }
            : { lat: null, lng: null, placeId: "" },

          destination: state.destination || "",
          destinationCoords: destinationCoords
            ? { ...destinationCoords }
            : { lat: null, lng: null, placeId: "" },

          km: Number(state.km) || 0,

          // ========= Estructura profesional =========
          pickup,
          dropoff,

          // ========= Campos legacy / compatibilidad =========
          pickupApt,
          pickupReference: pickupApt,
          dropoffApt,
          dropoffReference: dropoffApt,

          contactFrom,
          contactTo: recipientPhone,

          sender: {
            name: contactFromName,
            phone: contactFrom,
            floor: pickupApt,
            floorOrReference: pickupApt,
          },

          recipient: {
            name: recipientName,
            phone: recipientPhone,
            floor: dropoffApt,
            floorOrReference: dropoffApt,
          },

          notesFrom,
          notesTo,
          notes: {
            origen: notesFrom,
            destino: notesTo,
          },

          // ========= Económico =========
          price,
          breakdown: state.breakdown || null,
          quotedAt: state.quotedAt || null,

          // ========= Pago =========
          paymentMethod,
          paymentLabel,
          paymentStatus,
          paymentAmount: price,
          paymentCurrency: "ARS",
          paymentProvider:
            paymentMethod === "mercadopago" ? "mercadopago" : null,

          requiresCashHandling,
          requiresMercadoPago,

          matchRequirements: {
            operationType,
            serviceType: state.serviceType || "simple",
            paymentMethod,
            requiresCashHandling,
            requiresMercadoPago,
          },

          payment: {
            method: paymentMethod,
            label: paymentLabel,
            status: paymentStatus,
            amount: price,
            currency: "ARS",
            provider:
              paymentMethod === "mercadopago" ? "mercadopago" : null,
            requiresCashHandling,
            requiresMercadoPago,
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

      // ========= Reset para iniciar pedido nuevo =========
      resetDraft: () => {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}

        setState((s) => ({
          ...initialState,
          allowsFallbackToLocal: s.allowsFallbackToLocal ?? true,
          priority: s.priority || "normal",
        }));
      },

      // ========= Reset total =========
      reset: () => {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem("FLOW_OPERATION_TYPE");
        } catch {}

        setState({ ...initialState });
      },
    }),
    [state]
  );

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
    typeof coords.placeId === "string" ? coords.placeId : coords.place_id || "";

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

function safeReadOperationType() {
  try {
    const value = sessionStorage.getItem("FLOW_OPERATION_TYPE");
    return value === "retiro" || value === "envio" ? value : "";
  } catch {
    return "";
  }
}