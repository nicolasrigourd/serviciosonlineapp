import React, { useEffect, useMemo, useRef, useState } from "react";
import FlowHeader from "../../components/flowheader/FlowHeader";
import { useFlow } from "../../state/FlowContext";
import { loadGoogleMaps } from "../../lib/googleMapsLoader";
import AdressMapPicker from "../../components/AdressMapPicker/AdressMapPicker"
import { useNavigate } from "react-router-dom";
import styles from "./Enviar.module.css";

const DEFAULT_CENTER = {
  lat: -27.7834,
  lng: -64.2642,
};

const RATE_PER_KM = 1000;
const BASE_RATE = 0;
const MIN_FARE = 0;

function hasValidCoords(coords) {
  return (
    coords &&
    Number.isFinite(Number(coords.lat)) &&
    Number.isFinite(Number(coords.lng))
  );
}

function normalizeAddress(value) {
  return String(value || "").trim();
}

function parseCoordsFromText(text) {
  const raw = decodeURIComponent(String(text || "").trim());

  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);

    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return { lat, lng, placeId: "" };
      }
    }
  }

  return null;
}

function getDefaultUserAddress() {
  try {
    const raw = localStorage.getItem("SessionUser");
    const user = raw ? JSON.parse(raw) : null;

    if (!user) return null;

    const addresses = Array.isArray(user.addresses) ? user.addresses : [];
    const def = addresses.find((item) => item?.isDefault) || addresses[0] || null;

    if (def?.address) {
      return {
        address: def.address,
        coords: hasValidCoords(def)
          ? {
              lat: Number(def.lat),
              lng: Number(def.lng),
              placeId: def.placeId || "",
            }
          : null,
      };
    }

    if (user.direccion) {
      return {
        address: user.direccion,
        coords: null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function calcQuote({ km, serviceSurcharge = 0 }) {
  const kmNumber = Number(km || 0);
  const surchargePct = Number(serviceSurcharge || 0);

  const perKm = Math.round(kmNumber * RATE_PER_KM);
  const subtotal = BASE_RATE + perKm;
  const surchargeAmt = Math.round(subtotal * surchargePct);

  let total = subtotal + surchargeAmt;
  let minApplied = false;

  if (MIN_FARE > 0 && total < MIN_FARE) {
    total = MIN_FARE;
    minApplied = true;
  }

  return {
    base: BASE_RATE,
    km: Number(kmNumber.toFixed(2)),
    ratePerKm: RATE_PER_KM,
    perKm,
    subtotal,
    surchargePct,
    surchargeAmt,
    minFare: MIN_FARE,
    minApplied,
    total,
  };
}

export default function Enviar() {
  const {
    state,
    setOrigin,
    setDestination,
    setKm,
    setPrice,
    setOriginCoords,
    setDestinationCoords,
    setQuote,
    buildOrder,
  } = useFlow();

  const navigate = useNavigate();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef({ from: null, to: null });
  const geocoderRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);

  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const fromAutoRef = useRef(null);
  const toAutoRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapPicker, setMapPicker] = useState({
    open: false,
    type: null,
  });

  const [routeStatus, setRouteStatus] = useState("");
  const [localError, setLocalError] = useState("");
  const [routeData, setRouteData] = useState(null);
  const [autoQuote, setAutoQuote] = useState(null);

  const originConfirmed = hasValidCoords(state.originCoords);
  const destinationConfirmed = hasValidCoords(state.destinationCoords);
  const hasBothLocations = originConfirmed && destinationConfirmed;

  const showQuoteSummary =
    Boolean(routeData) &&
    Boolean(autoQuote) &&
    Number(autoQuote?.total || 0) > 0;

  const serviceLabel = useMemo(() => {
    const map = {
      simple: "Simple",
      box: "Box",
      bigbox: "BigBox",
      valores: "Valores",
      delivery: "Delivery",
    };

    return map[String(state.serviceType || "").toLowerCase()] || "Envío";
  }, [state.serviceType]);

  useEffect(() => {
    try {
      setDestination("");
      setDestinationCoords?.(null);
      setKm(0);
    } catch {}

    if (!state.origin) {
      const defaultAddress = getDefaultUserAddress();

      if (defaultAddress?.address) {
        try {
          setOrigin(defaultAddress.address, defaultAddress.coords || null);
        } catch {
          setOrigin(defaultAddress.address);
        }

        if (defaultAddress.coords) {
          try {
            setOriginCoords?.(defaultAddress.coords);
          } catch {}
        }
      }
    }

    if (toInputRef.current) {
      toInputRef.current.value = "";
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!apiKey) {
        setLocalError("Falta configurar Google Maps.");
        return;
      }

      const google = await loadGoogleMaps(apiKey);

      if (!isMounted || !mapRef.current) return;

      geocoderRef.current = new google.maps.Geocoder();
      directionsServiceRef.current = new google.maps.DirectionsService();

      mapObjRef.current = new google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: mapObjRef.current,
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#16a34a",
          strokeOpacity: 0.92,
          strokeWeight: 5,
        },
      });

      fromAutoRef.current = new google.maps.places.Autocomplete(
        fromInputRef.current,
        {
          fields: ["place_id", "geometry", "formatted_address", "name"],
          componentRestrictions: { country: ["ar"] },
        }
      );

      fromAutoRef.current.addListener("place_changed", () => {
        const place = fromAutoRef.current.getPlace();
        handlePlaceSelected(place, "from");
      });

      toAutoRef.current = new google.maps.places.Autocomplete(toInputRef.current, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });

      toAutoRef.current.addListener("place_changed", () => {
        const place = toAutoRef.current.getPlace();
        handlePlaceSelected(place, "to");
      });

      if (hasValidCoords(state.originCoords)) {
        setMarker("from", state.originCoords);
      } else if (state.origin) {
        geocodeAndSet(state.origin, "from", { updateContext: false });
      }

      if (hasValidCoords(state.destinationCoords)) {
        setMarker("to", state.destinationCoords);
      } else if (state.destination) {
        geocodeAndSet(state.destination, "to", { updateContext: false });
      }

      fitToMarkers();
      setMapReady(true);
    }

    init().catch((error) => {
      console.error("[ENVIAR] Error inicializando mapa:", error);
      setLocalError("No pudimos cargar el mapa. Revisá tu conexión.");
    });

    return () => {
      isMounted = false;

      try {
        if (window.google?.maps?.event) {
          if (fromAutoRef.current) {
            window.google.maps.event.clearInstanceListeners(fromAutoRef.current);
          }

          if (toAutoRef.current) {
            window.google.maps.event.clearInstanceListeners(toAutoRef.current);
          }
        }

        Object.values(markersRef.current || {}).forEach((marker) => {
          if (marker?.setMap) marker.setMap(null);
        });

        if (directionsRendererRef.current) {
          directionsRendererRef.current.setMap(null);
        }
      } catch {}

      markersRef.current = { from: null, to: null };
      mapObjRef.current = null;
      geocoderRef.current = null;
      directionsServiceRef.current = null;
      directionsRendererRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (!mapReady) return;

    if (hasValidCoords(state.originCoords)) {
      setMarker("from", state.originCoords);
    }

    if (hasValidCoords(state.destinationCoords)) {
      setMarker("to", state.destinationCoords);
    }

    if (originConfirmed && destinationConfirmed) {
      drawRouteAndQuote();
    } else {
      clearRoute();
      fitToMarkers();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapReady,
    state.originCoords?.lat,
    state.originCoords?.lng,
    state.destinationCoords?.lat,
    state.destinationCoords?.lng,
    state.serviceType,
    state.surcharge,
  ]);

  function applyLocation(type, location) {
    const address = normalizeAddress(location?.address || location?.formatted);
    const coords = {
      lat: Number(location.lat),
      lng: Number(location.lng),
      placeId: location.placeId || "",
    };

    if (!address || !hasValidCoords(coords)) return;

    setLocalError("");
    setRouteStatus("");

    if (type === "from") {
      try {
        setOrigin(address, coords);
      } catch {
        setOrigin(address);
      }

      try {
        setOriginCoords?.(coords);
      } catch {}

      setMarker("from", coords);
    } else {
      try {
        setDestination(address, coords);
      } catch {
        setDestination(address);
      }

      try {
        setDestinationCoords?.(coords);
      } catch {}

      setMarker("to", coords);
    }

    fitToMarkers();
  }

  function handlePlaceSelected(place, type) {
    if (!place || !place.geometry) {
      setLocalError("Seleccioná una dirección válida del listado.");
      return;
    }

    const loc = place.geometry.location;

    applyLocation(type, {
      address: place.formatted_address || place.name || "",
      lat: loc.lat(),
      lng: loc.lng(),
      placeId: place.place_id || "",
    });
  }

  function geocodeAndSet(address, type, options = { updateContext: true }) {
    if (!geocoderRef.current || !address) return;

    geocoderRef.current.geocode({ address }, (res, status) => {
      if (status === "OK" && res?.[0]) {
        const loc = res[0].geometry.location;

        const location = {
          address: res[0].formatted_address || address,
          lat: loc.lat(),
          lng: loc.lng(),
          placeId: res[0].place_id || "",
        };

        if (options.updateContext) {
          applyLocation(type, location);
        } else {
          setMarker(type, location);
          fitToMarkers();
        }
      }
    });
  }

  async function reverseGeocode(coords) {
    if (!geocoderRef.current || !hasValidCoords(coords)) {
      return `Ubicación seleccionada (${Number(coords.lat).toFixed(6)}, ${Number(
        coords.lng
      ).toFixed(6)})`;
    }

    try {
      const result = await geocoderRef.current.geocode({
        location: {
          lat: Number(coords.lat),
          lng: Number(coords.lng),
        },
      });

      return (
        result?.results?.[0]?.formatted_address ||
        `Ubicación seleccionada (${Number(coords.lat).toFixed(6)}, ${Number(
          coords.lng
        ).toFixed(6)})`
      );
    } catch {
      return `Ubicación seleccionada (${Number(coords.lat).toFixed(6)}, ${Number(
        coords.lng
      ).toFixed(6)})`;
    }
  }

  function clearMarker(type) {
    if (markersRef.current[type]) {
      markersRef.current[type].setMap(null);
      markersRef.current[type] = null;
    }
  }

  function clearRoute() {
    try {
      directionsRendererRef.current?.setDirections({ routes: [] });
    } catch {}

    setRouteData(null);
    setAutoQuote(null);

    try {
      setKm(0);
    } catch {}
  }

  function clearLocationCoords(type) {
    clearRoute();
    setRouteStatus("");

    if (type === "from") {
      try {
        setOriginCoords?.(null);
      } catch {}

      clearMarker("from");
    } else {
      try {
        setDestinationCoords?.(null);
      } catch {}

      clearMarker("to");
    }
  }

  async function handleTextChange(type, value) {
    setLocalError("");

    if (type === "from") {
      setOrigin(value);
    } else {
      setDestination(value);
    }

    clearLocationCoords(type);

    const parsedCoords = parseCoordsFromText(value);

    if (parsedCoords && hasValidCoords(parsedCoords)) {
      const address = await reverseGeocode(parsedCoords);

      applyLocation(type, {
        address,
        ...parsedCoords,
      });
    }
  }

  function setMarker(type, coords) {
    const google = window.google;
    const map = mapObjRef.current;

    if (!google || !map || !hasValidCoords(coords)) return;

    const markerType = type === "from" ? "from" : "to";

    if (!markersRef.current[markerType]) {
      markersRef.current[markerType] = new google.maps.Marker({
        map,
        position: {
          lat: Number(coords.lat),
          lng: Number(coords.lng),
        },
        label: markerType === "from" ? "A" : "B",
      });
    } else {
      markersRef.current[markerType].setPosition({
        lat: Number(coords.lat),
        lng: Number(coords.lng),
      });
    }
  }

  function fitToMarkers() {
    const map = mapObjRef.current;
    const google = window.google;

    if (!map || !google) return;

    const { from, to } = markersRef.current;
    const bounds = new google.maps.LatLngBounds();
    let hasAny = false;

    if (from) {
      bounds.extend(from.getPosition());
      hasAny = true;
    }

    if (to) {
      bounds.extend(to.getPosition());
      hasAny = true;
    }

    if (!hasAny) return;

    if (from && to) {
      map.fitBounds(bounds, {
        top: 70,
        right: 70,
        bottom: 70,
        left: 70,
      });
    } else {
      map.setCenter((from || to).getPosition());
      map.setZoom(15);
    }
  }

  function drawRouteAndQuote() {
    const google = window.google;

    if (!google || !directionsServiceRef.current) return;

    if (!hasValidCoords(state.originCoords) || !hasValidCoords(state.destinationCoords)) {
      return;
    }

    setRouteStatus("Calculando ruta...");
    setLocalError("");

    directionsServiceRef.current.route(
      {
        origin: {
          lat: Number(state.originCoords.lat),
          lng: Number(state.originCoords.lng),
        },
        destination: {
          lat: Number(state.destinationCoords.lat),
          lng: Number(state.destinationCoords.lng),
        },
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (status !== "OK" || !result?.routes?.length) {
          setRouteStatus("");
          setLocalError("No pudimos calcular una ruta entre esas direcciones.");
          clearRoute();
          fitToMarkers();
          return;
        }

        const leg = result.routes?.[0]?.legs?.[0];

        if (!leg?.distance?.value) {
          setRouteStatus("");
          setLocalError("No encontramos distancia válida para esa ruta.");
          clearRoute();
          fitToMarkers();
          return;
        }

        directionsRendererRef.current?.setDirections(result);

        const kmNumber = leg.distance.value / 1000;
        const quote = calcQuote({
          km: kmNumber,
          serviceSurcharge: state.surcharge,
        });

        try {
          setKm(quote.km);
        } catch {}

        if (typeof setPrice === "function") {
          try {
            setPrice(quote.total);
          } catch {}
        }

        setRouteData({
          km: quote.km,
          distanceText: leg.distance?.text || `${quote.km} km`,
          durationText: leg.duration?.text || "",
        });

        setAutoQuote(quote);
        setRouteStatus("");
        setLocalError("");
      }
    );
  }

  function openMapPicker(type) {
    setMapPicker({
      open: true,
      type,
    });
  }

  function closeMapPicker() {
    setMapPicker({
      open: false,
      type: null,
    });
  }

  function handleMapConfirm(location) {
    const type = mapPicker.type;

    if (!type || !location) return;

    applyLocation(type, {
      address: location.address || location.formatted,
      lat: location.lat,
      lng: location.lng,
      placeId: location.placeId || "",
    });

    closeMapPicker();
  }

  function handleNext() {
    if (!originConfirmed) {
      setLocalError("Confirmá el origen seleccionando una dirección o ajustando en el mapa.");
      return;
    }

    if (!destinationConfirmed) {
      setLocalError("Confirmá el destino seleccionando una dirección o ajustando en el mapa.");
      return;
    }

    if (!autoQuote || !routeData) {
      setLocalError("Esperá a que se calcule la ruta y el precio.");
      return;
    }

    const quotePayload = {
      km: autoQuote.km,
      total: autoQuote.total,
      distanceText: routeData.distanceText,
      durationText: routeData.durationText,
      breakdown: autoQuote,
    };

    if (typeof setQuote === "function") {
      setQuote(quotePayload);
    }

    if (typeof setPrice === "function") {
      setPrice(autoQuote.total);
    }

    const draft =
      typeof buildOrder === "function"
        ? buildOrder()
        : {
            origin: state.origin,
            originCoords: state.originCoords,
            destination: state.destination,
            destinationCoords: state.destinationCoords,
            km: autoQuote.km,
            price: autoQuote.total,
            serviceType: state.serviceType,
            surcharge: state.surcharge,
            breakdown: autoQuote,
          };

    console.log("[ENVIAR] Draft order →", draft);

    navigate("/flow/datos");
  }

  const pickerInitialCoords =
    mapPicker.type === "from"
      ? state.originCoords
      : mapPicker.type === "to"
        ? state.destinationCoords
        : null;

  const pickerInitialAddress =
    mapPicker.type === "from"
      ? state.origin
      : mapPicker.type === "to"
        ? state.destination
        : "";

  return (
    <div className={styles.screen}>
      <FlowHeader title="Envíos" />

      <section className={styles.mapOuter} aria-label="Mapa del envío">
        <div className={styles.mapWrap}>
          <div ref={mapRef} className={styles.map} />

          <div className={styles.mapHint}>
            <span>{serviceLabel}</span>
            <strong>
              {routeData
                ? `${routeData.distanceText}${
                    routeData.durationText ? ` · ${routeData.durationText}` : ""
                  }`
                : hasBothLocations
                  ? "Calculando ruta..."
                  : "Confirmá origen y destino"}
            </strong>
          </div>
        </div>
      </section>

      <section
        className={`${styles.sheet} ${showQuoteSummary ? styles.sheetWithQuote : ""}`}
        aria-label="Datos del envío"
      >
        <div className={styles.grabber} aria-hidden="true" />

        <div className={styles.sheetHeader}>
          <span>Nuevo envío</span>
          <h1>Indicá origen y destino</h1>
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="from">
                Origen
              </label>

              <span
                className={`${styles.statusPill} ${
                  originConfirmed ? styles.statusOk : styles.statusWarn
                }`}
              >
                {originConfirmed ? "Confirmado" : "Sin confirmar"}
              </span>
            </div>

            <div className={styles.inputActionRow}>
              <input
                id="from"
                ref={fromInputRef}
                type="text"
                className={styles.input}
                placeholder="Dirección de retiro"
                value={state.origin || ""}
                onChange={(event) => handleTextChange("from", event.target.value)}
              />

              <button
                type="button"
                className={styles.mapBtn}
                onClick={() => openMapPicker("from")}
              >
                Ajustar
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="to">
                Destino
              </label>

              <span
                className={`${styles.statusPill} ${
                  destinationConfirmed ? styles.statusOk : styles.statusWarn
                }`}
              >
                {destinationConfirmed ? "Confirmado" : "Sin confirmar"}
              </span>
            </div>

            <div className={styles.inputActionRow}>
              <input
                id="to"
                ref={toInputRef}
                type="text"
                className={styles.input}
                placeholder="Dirección, link o coordenadas"
                value={state.destination || ""}
                onChange={(event) => handleTextChange("to", event.target.value)}
              />

              <button
                type="button"
                className={styles.mapBtn}
                onClick={() => openMapPicker("to")}
              >
                Ajustar
              </button>
            </div>

            {!showQuoteSummary && (
              <p className={styles.helperText}>
                Podés pegar coordenadas o una ubicación copiada de Maps.
              </p>
            )}
          </div>

          {(routeStatus || localError) && (
            <div
              className={`${styles.routeNotice} ${
                localError ? styles.routeNoticeError : styles.routeNoticeOk
              }`}
            >
              {localError || routeStatus}
            </div>
          )}

          {showQuoteSummary && (
            <div className={styles.quoteSection}>
              <div className={styles.quoteBox}>
                <div className={styles.quoteMain}>
                  <span>Total estimado</span>
                  <strong>
                    ${Number(autoQuote.total).toLocaleString("es-AR")}
                  </strong>
                </div>

                <div className={styles.quoteMeta}>
                  <div>
                    <span>Servicio</span>
                    <strong>{serviceLabel}</strong>
                  </div>

                  <div>
                    <span>Distancia</span>
                    <strong>{routeData.distanceText}</strong>
                  </div>

                  {routeData.durationText && (
                    <div>
                      <span>Tiempo</span>
                      <strong>{routeData.durationText}</strong>
                    </div>
                  )}
                </div>
              </div>

              <button type="button" className={styles.nextBtn} onClick={handleNext}>
                Siguiente
              </button>
            </div>
          )}
        </div>
      </section>

      <AdressMapPicker
        open={mapPicker.open}
        initialCoords={hasValidCoords(pickerInitialCoords) ? pickerInitialCoords : null}
        initialAddress={pickerInitialAddress}
        onClose={closeMapPicker}
        onConfirm={handleMapConfirm}
      />
    </div>
  );
}