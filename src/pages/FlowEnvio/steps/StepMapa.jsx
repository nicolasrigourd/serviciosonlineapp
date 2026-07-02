import React, { useEffect, useRef, useState } from "react";
import { useFlow } from "../../../state/FlowContext";
import { useFlowWizard } from "../../../components/FlowWizard/FlowWizard";
import { clienteDb } from "../../../db/clienteDb";
import { loadGoogleMaps } from "../../../lib/googleMapsLoader";
import { calcularAdicionalManejo } from "../../../lib/cashHandling";
import AdressMapPicker from "../../../components/AdressMapPicker/AdressMapPicker";
import styles from "./StepMapa.module.css";

const DEFAULT_CENTER = { lat: -27.7834, lng: -64.2642 };

// Estilo oscuro del mapa — colores que complementan la paleta de la app
const DARK_MAP_STYLE = [
  { elementType: "geometry",                                             stylers: [{ color: "#1A1D26" }] },
  { elementType: "labels.icon",                                         stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill",                                    stylers: [{ color: "#6B7280" }] },
  { elementType: "labels.text.stroke",                                  stylers: [{ color: "#161B22" }] },
  { featureType: "administrative",      elementType: "geometry",        stylers: [{ color: "#2a3142" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#D1D5DB" }] },
  { featureType: "poi",                                                  stylers: [{ visibility: "off" }] },
  { featureType: "poi.park",            elementType: "geometry",        stylers: [{ color: "#1e2d24" }] },
  { featureType: "poi.park",            elementType: "labels.text.fill", stylers: [{ color: "#4B6A50" }] },
  { featureType: "road",                elementType: "geometry",        stylers: [{ color: "#2d3848" }] },
  { featureType: "road",                elementType: "geometry.stroke", stylers: [{ color: "#1A1D26" }] },
  { featureType: "road",                elementType: "labels.text.fill", stylers: [{ color: "#9CA3AF" }] },
  { featureType: "road.highway",        elementType: "geometry",        stylers: [{ color: "#3d4f64" }] },
  { featureType: "road.highway",        elementType: "geometry.stroke", stylers: [{ color: "#1f2d3d" }] },
  { featureType: "road.highway",        elementType: "labels.text.fill", stylers: [{ color: "#B0BEC5" }] },
  { featureType: "transit",                                              stylers: [{ visibility: "off" }] },
  { featureType: "water",               elementType: "geometry",        stylers: [{ color: "#0D1117" }] },
  { featureType: "water",               elementType: "labels.text.fill", stylers: [{ color: "#4B5563" }] },
];

function getMapStyles() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? DARK_MAP_STYLE : [];
}

function hasCoords(c) {
  return c && isFinite(Number(c.lat)) && isFinite(Number(c.lng));
}

function fmtARS(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

export default function StepMapa() {
  const { state, setOrigin, setDestination, setOriginCoords, setDestinationCoords, setKm, setPrice, setQuote, setStoreName } = useFlow();
  const { next } = useFlowWizard();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Refs de Google Maps
  const mapRef        = useRef(null);
  const mapObjRef     = useRef(null);
  const geocoderRef   = useRef(null);
  const dirSvcRef     = useRef(null);
  const dirRndRef     = useRef(null);
  const fromAutoRef   = useRef(null);
  const toAutoRef     = useRef(null);
  const fromInputRef  = useRef(null);
  const toInputRef    = useRef(null);
  const markersRef    = useRef({ from: null, to: null });

  const [mapReady,  setMapReady]  = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [quote,     setLocalQuote]= useState(null);
  const [status,    setStatus]    = useState("");
  const [error,     setError]     = useState("");
  const [picker,    setPicker]    = useState({ open: false, type: null });
  const [ratePerKm, setRatePerKm] = useState(1000);

  const originOk = hasCoords(state.originCoords);
  const destOk   = hasCoords(state.destinationCoords);
  const hasRoute = Boolean(routeData && quote && quote.total > 0);
  const canNext  = originOk && destOk && hasRoute;

  // Leer tarifa de IndexedDB
  useEffect(() => {
    clienteDb.pricing.get("pricing")
      .then((r) => { if (r?.ratePerKm) setRatePerKm(Number(r.ratePerKm)); })
      .catch(() => {});
  }, []);

  // Pre-llenar la dirección del usuario cuando se conoce el tipo de operación.
  // envio → pre-llena origen; retiro → pre-llena destino.
  useEffect(() => {
    const op = state.operationType;
    if (!op) return;

    const isRetiro        = op === "retiro";
    const isCompras       = op === "compras";
    const isValoresRetiro = op === "valores" && state.valoresMode === "retiro";
    // retiro, compras y valores-retiro pre-llenan destino; los demás pre-llenan origen
    const prefillDest = isRetiro || isCompras || isValoresRetiro;
    if (prefillDest ? state.destination : state.origin) return; // ya hay valor (draft)

    clienteDb.profile.get("me").then((user) => {
      if (!user) return;
      const addresses = Array.isArray(user.addresses) ? user.addresses : [];
      const def = addresses.find((a) => a?.isDefault) || addresses[0];
      const addr = def?.address || user.direccion;
      if (!addr) return;
      const coords = hasCoords(def)
        ? { lat: Number(def.lat), lng: Number(def.lng), placeId: def.placeId || "" }
        : null;
      if (prefillDest) setDestination(addr, coords);
      else             setOrigin(addr, coords);
    }).catch(() => {});
  }, [state.operationType]);

  // Inicializar mapa
  useEffect(() => {
    if (!apiKey) { setError("Falta configurar Google Maps."); return; }
    let alive = true;

    loadGoogleMaps(apiKey).then((google) => {
      if (!alive || !mapRef.current) return;

      geocoderRef.current = new google.maps.Geocoder();
      dirSvcRef.current   = new google.maps.DirectionsService();

      mapObjRef.current = new google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER, zoom: 13,
        disableDefaultUI: true, zoomControl: false,
        gestureHandling: "greedy", clickableIcons: false,
        styles: getMapStyles(),
      });

      dirRndRef.current = new google.maps.DirectionsRenderer({
        map: mapObjRef.current,
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#39E010", strokeOpacity: 0.9, strokeWeight: 5 },
      });

      // Autocomplete origen
      fromAutoRef.current = new google.maps.places.Autocomplete(fromInputRef.current, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });
      fromAutoRef.current.addListener("place_changed", () => {
        const place = fromAutoRef.current.getPlace();
        if (place?.geometry) applyPlace(place, "from");
      });

      // Autocomplete destino
      toAutoRef.current = new google.maps.places.Autocomplete(toInputRef.current, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });
      toAutoRef.current.addListener("place_changed", () => {
        const place = toAutoRef.current.getPlace();
        if (place?.geometry) applyPlace(place, "to");
      });

      // Restaurar marcadores si hay coords guardadas
      if (hasCoords(state.originCoords)) setMarker("from", state.originCoords);
      if (hasCoords(state.destinationCoords)) setMarker("to", state.destinationCoords);
      fitMarkers();
      setMapReady(true);
    }).catch(() => setError("No pudimos cargar el mapa."));

    return () => {
      alive = false;
      try {
        if (window.google?.maps?.event) {
          if (fromAutoRef.current) window.google.maps.event.clearInstanceListeners(fromAutoRef.current);
          if (toAutoRef.current)   window.google.maps.event.clearInstanceListeners(toAutoRef.current);
        }
        Object.values(markersRef.current).forEach((m) => m?.setMap?.(null));
        dirRndRef.current?.setMap?.(null);
      } catch {}
      markersRef.current = { from: null, to: null };
    };
  }, [apiKey]);

  // Actualizar estilo del mapa cuando cambia el tema
  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;
    const obs = new MutationObserver(() => {
      mapObjRef.current?.setOptions({ styles: getMapStyles() });
    });
    obs.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, [mapReady]);

  // Dibujar ruta cuando cambien las coords
  useEffect(() => {
    if (!mapReady) return;
    if (hasCoords(state.originCoords)) setMarker("from", state.originCoords);
    if (hasCoords(state.destinationCoords)) setMarker("to", state.destinationCoords);
    if (originOk && destOk) drawRoute();
    else { clearRoute(); fitMarkers(); }
  }, [mapReady, state.originCoords?.lat, state.originCoords?.lng, state.destinationCoords?.lat, state.destinationCoords?.lng, state.surcharge, ratePerKm]);

  function applyPlace(place, type) {
    const loc  = place.geometry.location;
    const addr = place.formatted_address || place.name || "";
    const coords = { lat: loc.lat(), lng: loc.lng(), placeId: place.place_id || "" };
    if (type === "from") {
      setOrigin(addr, coords);
      setMarker("from", coords);
      // Para compras capturamos el nombre del comercio desde Places
      if (state.operationType === "compras" && place.name) setStoreName(place.name);
    } else {
      setDestination(addr, coords);
      setMarker("to", coords);
    }
    fitMarkers();
    setError(""); setStatus("");
  }

  function setMarker(type, coords) {
    const google = window.google;
    const map = mapObjRef.current;
    if (!google || !map || !hasCoords(coords)) return;
    if (!markersRef.current[type]) {
      markersRef.current[type] = new google.maps.Marker({
        map, position: { lat: Number(coords.lat), lng: Number(coords.lng) },
        label: type === "from" ? "A" : "B",
      });
    } else {
      markersRef.current[type].setPosition({ lat: Number(coords.lat), lng: Number(coords.lng) });
    }
  }

  function fitMarkers() {
    const map = mapObjRef.current;
    const google = window.google;
    if (!map || !google) return;
    const { from, to } = markersRef.current;
    const bounds = new google.maps.LatLngBounds();
    if (from) bounds.extend(from.getPosition());
    if (to)   bounds.extend(to.getPosition());
    if (!from && !to) return;
    if (from && to) map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    else { map.setCenter((from || to).getPosition()); map.setZoom(15); }
  }

  function clearRoute() {
    try { dirRndRef.current?.setDirections({ routes: [] }); } catch {}
    setRouteData(null); setLocalQuote(null);
    try { setKm(0); } catch {}
  }

  function drawRoute() {
    if (!dirSvcRef.current || !hasCoords(state.originCoords) || !hasCoords(state.destinationCoords)) return;
    setStatus("Calculando ruta…"); setError("");

    dirSvcRef.current.route(
      {
        origin: { lat: Number(state.originCoords.lat), lng: Number(state.originCoords.lng) },
        destination: { lat: Number(state.destinationCoords.lat), lng: Number(state.destinationCoords.lng) },
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, st) => {
        if (st !== "OK" || !result?.routes?.length) {
          setStatus(""); setError("No pudimos calcular la ruta."); clearRoute(); fitMarkers(); return;
        }
        const leg = result.routes[0].legs[0];
        if (!leg?.distance?.value) { setStatus(""); setError("Distancia inválida."); return; }

        dirRndRef.current?.setDirections(result);
        const km           = leg.distance.value / 1000;
        const surcharge    = Number(state.surcharge) || 0;
        const transportFee = calcularAdicionalManejo(state.declaredValue, state.cashHandlingFeeConfig);
        const service      = Math.round(km * ratePerKm * (1 + surcharge)) + transportFee;
        const q = {
          km: parseFloat(km.toFixed(2)),
          total: service,
          distanceText: leg.distance.text,
          durationText: leg.duration?.text || "",
        };

        const durationSec = leg.duration?.value || 0;
        const durationMin = Math.round(durationSec / 60);

        setRouteData({ km: q.km, distanceText: q.distanceText, durationText: q.durationText });
        setLocalQuote(q);
        setStatus(""); setError("");
        setKm(q.km);
        setPrice(q.total);
        setQuote({ km: q.km, total: q.total, durationMin, durationSec, breakdown: null });
      }
    );
  }

  async function reverseGeocode(coords) {
    if (!geocoderRef.current) return `${Number(coords.lat).toFixed(5)}, ${Number(coords.lng).toFixed(5)}`;
    try {
      const res = await geocoderRef.current.geocode({ location: { lat: Number(coords.lat), lng: Number(coords.lng) } });
      return res?.results?.[0]?.formatted_address || `${Number(coords.lat).toFixed(5)}, ${Number(coords.lng).toFixed(5)}`;
    } catch { return `${Number(coords.lat).toFixed(5)}, ${Number(coords.lng).toFixed(5)}`; }
  }

  async function handleTextChange(type, value) {
    setError("");
    if (type === "from") setOrigin(value);
    else setDestination(value);
    // Intento parsear coordenadas pegadas del clipboard
    const parsed = parseCoordsText(value);
    if (parsed) {
      if (type === "from") setOriginCoords(parsed);
      else setDestinationCoords(parsed);
      const addr = await reverseGeocode(parsed);
      if (type === "from") setOrigin(addr, parsed);
      else setDestination(addr, parsed);
    }
  }

  function handlePickerConfirm(loc) {
    if (!loc || !picker.type) return;
    const coords = { lat: loc.lat, lng: loc.lng, placeId: loc.placeId || "" };
    if (picker.type === "from") { setOrigin(loc.address || loc.formatted, coords); }
    else { setDestination(loc.address || loc.formatted, coords); }
    setPicker({ open: false, type: null });
  }

  const isRetiro        = state.operationType === "retiro";
  const isCompras       = state.operationType === "compras";
  const isValores       = state.operationType === "valores";
  const isValoresRetiro = isValores && state.valoresMode === "retiro";

  return (
    <div className={styles.step}>
      {/* Mapa */}
      <div className={styles.mapWrap}>
        <div ref={mapRef} className={styles.map} />
        {routeData && (
          <div className={styles.routeChip}>
            <span>{routeData.distanceText}</span>
            {routeData.durationText && <span>· {routeData.durationText}</span>}
          </div>
        )}
      </div>

      {/* Inputs */}
      <div className={styles.inputs}>
        {/* Origen */}
        <div className={styles.inputRow}>
          <span className={`${styles.dot} ${styles.dotFrom}`} />
          <div className={styles.inputWrap}>
            <input
              ref={fromInputRef}
              type="text"
              className={styles.input}
              placeholder={isCompras ? "¿Dónde compramos?" : isValoresRetiro ? "¿Dónde está el dinero?" : isRetiro ? "¿Dónde está el paquete?" : isValores ? "¿Desde dónde enviás el dinero?" : "Dirección de origen"}
              value={state.origin || ""}
              onChange={(e) => handleTextChange("from", e.target.value)}
            />
            <span className={`${styles.statusPill} ${originOk ? styles.ok : ""}`}>
              {originOk ? "✓" : "Sin confirmar"}
            </span>
          </div>
          <button type="button" className={styles.mapBtn} onClick={() => setPicker({ open: true, type: "from" })} aria-label="Ajustar en mapa">
            {mapPinIcon}
          </button>
        </div>

        <div className={styles.dividerLine} />

        {/* Destino */}
        <div className={styles.inputRow}>
          <span className={`${styles.dot} ${styles.dotTo}`} />
          <div className={styles.inputWrap}>
            <input
              ref={toInputRef}
              type="text"
              className={styles.input}
              placeholder={isCompras ? "¿A dónde llevamos las compras?" : isValoresRetiro ? "¿A dónde te lo traemos?" : isRetiro ? "¿A dónde lo traemos?" : isValores ? "¿A dónde enviamos el dinero?" : "Dirección de destino"}
              value={state.destination || ""}
              onChange={(e) => handleTextChange("to", e.target.value)}
            />
            <span className={`${styles.statusPill} ${destOk ? styles.ok : ""}`}>
              {destOk ? "✓" : "Sin confirmar"}
            </span>
          </div>
          <button type="button" className={styles.mapBtn} onClick={() => setPicker({ open: true, type: "to" })} aria-label="Ajustar en mapa">
            {mapPinIcon}
          </button>
        </div>
      </div>

      {/* Mensaje estado / error */}
      {(status || error) && (
        <p className={`${styles.notice} ${error ? styles.noticeError : ""}`}>{error || status}</p>
      )}

      {/* Quote y botón siguiente */}
      {hasRoute && (
        <div className={styles.quoteRow}>
          <div className={styles.quoteInfo}>
            <span className={styles.quoteLabel}>Total estimado</span>
            <strong className={styles.quotePrice}>{fmtARS(quote.total)}</strong>
          </div>
          <button type="button" className={styles.nextBtn} onClick={next}>
            Siguiente {arrowIcon}
          </button>
        </div>
      )}

      <AdressMapPicker
        open={picker.open}
        initialCoords={picker.type === "from" ? state.originCoords : state.destinationCoords}
        initialAddress={picker.type === "from" ? state.origin : state.destination}
        onClose={() => setPicker({ open: false, type: null })}
        onConfirm={handlePickerConfirm}
      />
    </div>
  );
}

function parseCoordsText(text) {
  const raw = decodeURIComponent(String(text || "").trim());
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /^(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
        return { lat, lng, placeId: "" };
    }
  }
  return null;
}

const mapPinIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z"/>
    <circle cx="12" cy="11" r="2.5"/>
  </svg>
);

const arrowIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
