import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clienteDb } from "../db/clienteDb";

const FlowContext = createContext(null);

const DRAFT_KEY = "flow_draft";

const VALID_OP_TYPES = ["envio", "retiro", "bigbox", "delivery", "valores", "compras"];

const initialState = {
  // ── Geografía ─────────────────────────────────────────────────
  origin: "",
  originCoords: null,
  destination: "",
  destinationCoords: null,

  // ── Tipo de pedido ─────────────────────────────────────────────
  operationType: "",    // "envio" | "retiro" | "bigbox" | "delivery" | "valores" | "compras"
  serviceCategory: "",  // "delivery" | "" — contexto del flow padre
  serviceType: "simple",
  surcharge: 0,

  // ── Compras ────────────────────────────────────────────────────
  storeName: "",        // nombre del comercio capturado de Places
  shoppingList: [],     // array de strings, máx 10
  shoppingBudget: 0,    // dinero estimado que necesita el repartidor

  // ── Distancia y cotización ─────────────────────────────────────
  km: 0,
  price: 0,
  durationMin: 0,
  durationSec: 0,
  breakdown: null,
  quotedAt: null,

  // ── Quién abona el servicio ────────────────────────────────────
  serviceChargedTo: "remitente",  // "remitente" | "destinatario"
  paymentMethod: "",              // "cash" | "mercadopago"

  // ── ¿El repartidor paga algo al retirar? ──────────────────────
  pickupPaymentRequired: false,
  pickupPaymentAmount: 0,

  // ── Delivery específico ────────────────────────────────────────
  deliveryOrderDetail: "",
  deliveryOrderAmount: 0,

  // ── Valores específico ─────────────────────────────────────────
  valoresMode: "",   // "envio" | "retiro"
  declaredValue: 0,
  securityPin: "",

  // ── Punto de retiro ────────────────────────────────────────────
  contactFromName: "",
  contactFrom: "",
  pickupFloor: "",
  pickupApartment: "",
  pickupReference: "",
  notesFrom: "",

  // ── Punto de entrega ───────────────────────────────────────────
  recipientName: "",
  recipientPhone: "",
  dropoffFloor: "",
  dropoffApartment: "",
  dropoffReference: "",
  notesTo: "",

  // ── Config de manejo de efectivo (viene de orderTypes en Firestore) ───────────
  cashHandlingFeeConfig: null,  // { active, type, charge, every }

  // ── Misc ───────────────────────────────────────────────────────
  allowsFallbackToLocal: true,
  priority: "normal",
};

export function FlowProvider({ children }) {
  const [state, setState] = useState({ ...initialState });
  const [draftRestored, setDraftRestored] = useState(false);

  // Restaurar draft de IndexedDB al montar
  useEffect(() => {
    clienteDb.config.get(DRAFT_KEY)
      .then((record) => {
        if (record?.value && typeof record.value === "object") {
          setState((s) => ({ ...initialState, ...record.value }));
        }
      })
      .catch(() => {})
      .finally(() => setDraftRestored(true));
  }, []);

  // Persistir draft en IndexedDB cuando cambia el estado (solo tras restaurar)
  useEffect(() => {
    if (!draftRestored) return;
    clienteDb.config.put({ key: DRAFT_KEY, value: state }).catch(() => {});
  }, [state, draftRestored]);

  const api = useMemo(
    () => ({
      state,

      // ── Geografía ────────────────────────────────────────────
      setOrigin: (text, coords = undefined) =>
        setState((s) => ({
          ...s,
          origin: text,
          originCoords:
            coords === undefined
              ? s.originCoords
              : coords ? normCoords(coords) : null,
        })),

      setDestination: (text, coords = undefined) =>
        setState((s) => ({
          ...s,
          destination: text,
          destinationCoords:
            coords === undefined
              ? s.destinationCoords
              : coords ? normCoords(coords) : null,
        })),

      setOriginCoords: (coords) =>
        setState((s) => ({ ...s, originCoords: normCoords(coords) })),

      setDestinationCoords: (coords) =>
        setState((s) => ({ ...s, destinationCoords: normCoords(coords) })),

      // ── Tipo de pedido ───────────────────────────────────────
      setOperationType: (value) =>
        setState((s) => ({
          ...s,
          operationType: VALID_OP_TYPES.includes(value) ? value : "",
        })),

      setServiceCategory: (value) =>
        setState((s) => ({ ...s, serviceCategory: String(value || "").trim() })),

      // ── Compras ──────────────────────────────────────────────
      setStoreName: (value) =>
        setState((s) => ({ ...s, storeName: String(value || "").trim() })),

      setShoppingList: (items) =>
        setState((s) => ({ ...s, shoppingList: Array.isArray(items) ? items.slice(0, 10) : [] })),

      setShoppingBudget: (value) =>
        setState((s) => ({ ...s, shoppingBudget: Number(value) || 0 })),

      setService: (type, surcharge = 0) =>
        setState((s) => ({
          ...s,
          serviceType: type || "simple",
          surcharge: Number(surcharge) || 0,
        })),

      // ── Cotización ───────────────────────────────────────────
      setKm: (value) =>
        setState((s) => ({ ...s, km: Number(value) || 0 })),

      setPrice: (amount) =>
        setState((s) => ({ ...s, price: Number(amount) || 0 })),

      setQuote: (quote) =>
        setState((s) => {
          if (!quote) return { ...s, km: 0, price: 0, durationMin: 0, durationSec: 0, breakdown: null, quotedAt: null };
          return {
            ...s,
            km:          Number(quote.km)          || 0,
            price:       Number(quote.total)        || 0,
            durationMin: Number(quote.durationMin)  || 0,
            durationSec: Number(quote.durationSec)  || 0,
            breakdown:   quote.breakdown || null,
            quotedAt:    Date.now(),
          };
        }),

      // ── Pago del servicio ────────────────────────────────────
      setServiceChargedTo: (value) =>
        setState((s) => ({
          ...s,
          serviceChargedTo: value === "destinatario" ? "destinatario" : "remitente",
        })),

      setPaymentMethod: (value) =>
        setState((s) => ({
          ...s,
          paymentMethod: value === "cash" || value === "mercadopago" ? value : "",
        })),

      // ── Pago en origen ───────────────────────────────────────
      setPickupPayment: (required, amount = 0) =>
        setState((s) => ({
          ...s,
          pickupPaymentRequired: Boolean(required),
          pickupPaymentAmount: required ? Number(amount) || 0 : 0,
        })),

      // ── Delivery ─────────────────────────────────────────────
      setDeliveryOrder: (detail, amount = 0) =>
        setState((s) => ({
          ...s,
          deliveryOrderDetail: String(detail || "").trim(),
          deliveryOrderAmount: Number(amount) || 0,
        })),

      // ── Valores ──────────────────────────────────────────────
      setValoresMode: (value) =>
        setState((s) => ({ ...s, valoresMode: value === "retiro" ? "retiro" : "envio" })),

      setDeclaredValue: (value) =>
        setState((s) => ({ ...s, declaredValue: Number(value) || 0 })),

      setSecurityPin: (value) =>
        setState((s) => ({ ...s, securityPin: String(value || "").trim() })),

      // ── Punto de retiro ──────────────────────────────────────
      setContactFromName: (value) =>
        setState((s) => ({ ...s, contactFromName: value || "" })),

      setContactFrom: (value) =>
        setState((s) => ({ ...s, contactFrom: value || "" })),

      setPickupFloor: (value) =>
        setState((s) => ({ ...s, pickupFloor: value || "" })),

      setPickupApartment: (value) =>
        setState((s) => ({ ...s, pickupApartment: value || "" })),

      setPickupReference: (value) =>
        setState((s) => ({ ...s, pickupReference: value || "" })),

      setNotesFrom: (value) =>
        setState((s) => ({ ...s, notesFrom: value || "" })),

      // ── Punto de entrega ─────────────────────────────────────
      setRecipientName: (value) =>
        setState((s) => ({ ...s, recipientName: value || "" })),

      setRecipientPhone: (value) =>
        setState((s) => ({ ...s, recipientPhone: value || "" })),

      setDropoffFloor: (value) =>
        setState((s) => ({ ...s, dropoffFloor: value || "" })),

      setDropoffApartment: (value) =>
        setState((s) => ({ ...s, dropoffApartment: value || "" })),

      setDropoffReference: (value) =>
        setState((s) => ({ ...s, dropoffReference: value || "" })),

      setNotesTo: (value) =>
        setState((s) => ({ ...s, notesTo: value || "" })),

      // ── Misc ─────────────────────────────────────────────────
      setCashHandlingFeeConfig: (config) =>
        setState((s) => ({ ...s, cashHandlingFeeConfig: config ?? null })),

      setPriority: (value) =>
        setState((s) => ({
          ...s,
          priority: value === "high" ? "high" : "normal",
        })),

      // ── Compat DatosAdicionales (nombres viejos) ─────────────
      setPickupApt: (value) =>
        setState((s) => ({ ...s, pickupReference: value || "" })),

      setDropoffApt: (value) =>
        setState((s) => ({ ...s, dropoffReference: value || "" })),

      setContactTo: (value) =>
        setState((s) => ({ ...s, recipientPhone: value || "" })),

      setContact: (value) =>
        setState((s) => ({ ...s, recipientPhone: value || "" })),

      // ── Builder — el caller pasa el user desde useAuth() ─────
      buildOrder: (sessionUser) => {
        const su = sessionUser || null;

        const originCoords = normCoords(state.originCoords);
        const destinationCoords = normCoords(state.destinationCoords);

        const contactFromName = String(state.contactFromName || "").trim();
        const contactFrom     = String(state.contactFrom     || "").trim();
        const recipientName   = String(state.recipientName   || "").trim();
        const recipientPhone  = String(state.recipientPhone  || "").trim();
        const pickupReference = String(state.pickupReference || "").trim();
        const dropoffReference= String(state.dropoffReference|| "").trim();
        const notesFrom       = String(state.notesFrom       || "").trim();
        const notesTo         = String(state.notesTo         || "").trim();
        const price           = Number(state.price) || 0;

        return {
          version: 3,
          appSource: "customer_app",
          status: "pendiente",

          operationType:  state.operationType  || "",
          serviceType:    state.serviceType    || "simple",
          surcharge:      Number(state.surcharge) || 0,

          customerUid: su?.uid  || null,
          userId:      su?.uid  || null,

          origin:      state.origin      || "",
          originCoords: originCoords ?? { lat: null, lng: null, placeId: "" },
          destination: state.destination || "",
          destinationCoords: destinationCoords ?? { lat: null, lng: null, placeId: "" },
          km: Number(state.km) || 0,

          pickup: {
            address:      state.origin || "",
            coords:       originCoords,
            contactName:  contactFromName,
            contactPhone: contactFrom,
            reference:    pickupReference,
            notes:        notesFrom,
          },

          dropoff: {
            address:      state.destination || "",
            coords:       destinationCoords,
            contactName:  recipientName,
            contactPhone: recipientPhone,
            reference:    dropoffReference,
            notes:        notesTo,
          },

          serviceChargedTo:       state.serviceChargedTo || "remitente",
          pickupPaymentRequired:  Boolean(state.pickupPaymentRequired),
          pickupPaymentAmount:    Number(state.pickupPaymentAmount) || 0,

          deliveryOrderDetail:  state.deliveryOrderDetail || "",
          deliveryOrderAmount:  Number(state.deliveryOrderAmount) || 0,

          declaredValue: Number(state.declaredValue) || 0,
          securityPin:   state.securityPin || "",

          price,
          breakdown:  state.breakdown  || null,
          quotedAt:   state.quotedAt   || null,

          paymentMethod: state.paymentMethod || "",

          allowsFallbackToLocal: Boolean(state.allowsFallbackToLocal),
          priority: state.priority || "normal",
        };
      },

      // ── Guardar pedido en IndexedDB ──────────────────────────
      saveOrder: (order) => {
        if (!order) return;
        const orderId = order.orderId || order.id;
        if (!orderId) return;
        clienteDb.orders.put({ ...order, orderId }).catch(() => {});
      },

      // ── Reset draft ──────────────────────────────────────────
      resetDraft: () => {
        clienteDb.config.delete(DRAFT_KEY).catch(() => {});
        setState((s) => ({
          ...initialState,
          allowsFallbackToLocal: s.allowsFallbackToLocal ?? true,
          priority: s.priority || "normal",
        }));
      },

      reset: () => {
        clienteDb.config.delete(DRAFT_KEY).catch(() => {});
        setState({ ...initialState });
      },
    }),
    [state]
  );

  return <FlowContext.Provider value={api}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow debe usarse dentro de <FlowProvider>");
  return ctx;
}

function normCoords(coords) {
  if (!coords) return null;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  const placeId =
    typeof coords.placeId === "string" ? coords.placeId : coords.place_id || "";
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng, placeId: placeId || "" };
}
