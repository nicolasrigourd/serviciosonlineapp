/*
import React, { useEffect, useRef } from "react";
import FlowHeader from "../../components/flowheader/FlowHeader";
import { useFlow } from "../../state/FlowContext";
import { loadGoogleMaps } from "../../lib/googleMapsLoader";
import ButonCalculo from "../../components/ButonCalculo/ButonCalculo";
import { useNavigate } from "react-router-dom"; // 👈 agregado
import styles from "./Enviar.module.css";

export default function Enviar() {
  const { state, setOrigin, setDestination, setKm, setPrice } = useFlow(); // setPrice es opcional si existe en tu context
  const navigate = useNavigate(); // 👈 agregado

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Refs para mapa y controles
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef({ from: null, to: null });
  const boundsRef = useRef(null);

  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const fromAutoRef = useRef(null);
  const toAutoRef = useRef(null);

  // Limpia destino y km al montar
  useEffect(() => {
    setDestination("");
    setKm(0);
    if (toInputRef.current) toInputRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill origen desde SessionUser (si no hay en flow)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("SessionUser");
      const user = raw ? JSON.parse(raw) : null;
      const baseAddr = user?.direccion || "Gorostiaga 1629, CABA";
      if (!state.origin) setOrigin(baseAddr);
    } catch {
      if (!state.origin) setOrigin("Gorostiaga 1629, CABA");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init Google Maps
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!apiKey) {
        console.warn("Falta VITE_GOOGLE_MAPS_API_KEY");
        return;
      }
      const google = await loadGoogleMaps(apiKey);
      if (!isMounted) return;

      // Crear mapa centrado en Santiago del Estero
      mapObjRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: -27.7834, lng: -64.2642 },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      boundsRef.current = new google.maps.LatLngBounds();

      // Autocomplete: Origen
      fromAutoRef.current = new google.maps.places.Autocomplete(fromInputRef.current, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });
      fromAutoRef.current.addListener("place_changed", () => {
        const place = fromAutoRef.current.getPlace();
        handlePlaceSelected(place, "from");
      });

      // Autocomplete: Destino
      toAutoRef.current = new google.maps.places.Autocomplete(toInputRef.current, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });
      toAutoRef.current.addListener("place_changed", () => {
        const place = toAutoRef.current.getPlace();
        handlePlaceSelected(place, "to");
      });

      // Si ya hay textos cargados (p. ej. origen), geocodificamos
      const geocoder = new google.maps.Geocoder();
      if (state.origin) {
        geocodeAndSet(geocoder, state.origin, "from");
      }
      if (state.destination) {
        geocodeAndSet(geocoder, state.destination, "to");
      }
    }

    init().catch(console.error);
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  function handlePlaceSelected(place, type) {
    if (!place || !place.geometry) return;

    const google = window.google;
    const loc = place.geometry.location;
    const position = { lat: loc.lat(), lng: loc.lng() };

    if (type === "from") {
      setOrigin(place.formatted_address || place.name || "");
    } else {
      setDestination(place.formatted_address || place.name || "");
    }

    setMarker(type, position);
    fitToMarkers();
    maybeComputeDistance();
  }

  function geocodeAndSet(geocoder, address, type) {
    const google = window.google;
    geocoder.geocode({ address }, (res, status) => {
      if (status === "OK" && res[0]) {
        const loc = res[0].geometry.location;
        const position = { lat: loc.lat(), lng: loc.lng() };
        setMarker(type, position);
        fitToMarkers();
        maybeComputeDistance();
      }
    });
  }

  function setMarker(type, position) {
    const google = window.google;
    const map = mapObjRef.current;
    if (!map) return;

    if (!markersRef.current[type]) {
      markersRef.current[type] = new google.maps.Marker({
        map,
        position,
        label: type === "from" ? "A" : "B",
      });
    } else {
      markersRef.current[type].setPosition(position);
    }
  }

  function fitToMarkers() {
    const map = mapObjRef.current;
    if (!map) return;

    const { from, to } = markersRef.current;
    const bounds = new window.google.maps.LatLngBounds();
    let hasAny = false;

    if (from) { bounds.extend(from.getPosition()); hasAny = true; }
    if (to)   { bounds.extend(to.getPosition());   hasAny = true; }

    if (!hasAny) return;

    if (from && to) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    } else {
      map.setCenter((from || to).getPosition());
      map.setZoom(14);
    }
  }

  function maybeComputeDistance() {
    const google = window.google;
    const { from, to } = markersRef.current;
    if (!from || !to) return;

    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [from.getPosition()],
        destinations: [to.getPosition()],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
      },
      (res, status) => {
        if (status !== "OK") return;
        const el = res.rows?.[0]?.elements?.[0];
        if (el?.status === "OK") {
          const meters = el.distance?.value ?? 0;
          setKm((meters / 1000).toFixed(2));
        }
      }
    );
  }

 
  
    
    if (typeof setPrice === "function") {
      try { setPrice(price); } catch {}
    }
    // Navegar a la página de Datos Adicionales
    navigate("/flow/datos");
  };

  return (
    <div className={styles.screen}>
      <FlowHeader title="Envíos" />

      <section className={styles.mapOuter} aria-label="Mapa">
        <div className={styles.mapWrap}>
          <div ref={mapRef} className={styles.map} />
        </div>
      </section>


      <section className={styles.sheet} aria-label="Datos del envío">
        <div className={styles.grabber} aria-hidden="true" />

        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="from">Origen</label>
            <input
              id="from"
              ref={fromInputRef}
              type="text"
              className={styles.input}
              placeholder="Dirección de retiro"
              value={state.origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="to">Destino</label>
            <input
              id="to"
              ref={toInputRef}
              type="text"
              className={styles.input}
              placeholder="Dirección de entrega"
              value={state.destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          <ButonCalculo
            serviceType={state.serviceType}
            origin={state.origin}
            destination={state.destination}
            km={state.km}
            ratePerKm={1000}
            onAccept={handleAcceptQuote} // 👈 acá conectamos la navegación
          />
        </div>
      </section>
    </div>
  );
}
*/
import React, { useEffect, useRef } from "react";
import FlowHeader from "../../components/flowheader/FlowHeader";
import { useFlow } from "../../state/FlowContext";
import { loadGoogleMaps } from "../../lib/googleMapsLoader";
import ButonCalculo from "../../components/ButonCalculo/ButonCalculo";
import { useNavigate } from "react-router-dom";
import styles from "./Enviar.module.css";

export default function Enviar() {
  const {
    state,
    setOrigin, setDestination, setKm, setPrice,
    setOriginCoords, setDestinationCoords,
    setQuote, buildOrder
  } = useFlow();
  const navigate = useNavigate();

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Refs para mapa y controles
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef({ from: null, to: null });

  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const fromAutoRef = useRef(null);
  const toAutoRef = useRef(null);

  // Al montar: limpiar destino/km e hidratar origen desde SessionUser si falta
  useEffect(() => {
    try { setDestination(""); } catch {}
    try { setKm(0); } catch {}
    if (toInputRef.current) toInputRef.current.value = "";

    if (!state.origin) {
      try {
        const raw = localStorage.getItem("SessionUser");
        const su = raw ? JSON.parse(raw) : null;
        const baseAddr = su?.direccion || "";
        if (baseAddr) {
          const def = Array.isArray(su?.addresses) ? su.addresses.find(a => a?.isDefault) : null;
          const coords = def ? { lat: def.lat ?? null, lng: def.lng ?? null, placeId: def.placeId || "" } : null;
          setOrigin(baseAddr, coords || null);
          if (coords && typeof setOriginCoords === "function") setOriginCoords(coords);
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init Google Maps + Autocomplete
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!apiKey) {
        console.warn("Falta VITE_GOOGLE_MAPS_API_KEY");
        return;
      }
      const google = await loadGoogleMaps(apiKey);
      if (!isMounted) return;

      // Crear mapa (centro neutral, el fit se ajusta con marcadores)
      mapObjRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: -27.7834, lng: -64.2642 },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Autocomplete: Origen
      fromAutoRef.current = new google.maps.places.Autocomplete(fromInputRef.current, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });
      fromAutoRef.current.addListener("place_changed", () => {
        const place = fromAutoRef.current.getPlace();
        handlePlaceSelected(place, "from");
      });

      // Autocomplete: Destino
      toAutoRef.current = new google.maps.places.Autocomplete(toInputRef.current, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });
      toAutoRef.current.addListener("place_changed", () => {
        const place = toAutoRef.current.getPlace();
        handlePlaceSelected(place, "to");
      });

      // Geocodificar textos ya cargados (si hubiera)
      const geocoder = new google.maps.Geocoder();
      if (state.origin) {
        geocodeAndSet(geocoder, state.origin, "from");
      }
      if (state.destination) {
        geocodeAndSet(geocoder, state.destination, "to");
      }
    }

    init().catch(console.error);
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  function handlePlaceSelected(place, type) {
    if (!place || !place.geometry) return;

    const loc = place.geometry.location;
    const coords = {
      lat: loc.lat(),
      lng: loc.lng(),
      placeId: place.place_id || ""
    };
    const formatted = place.formatted_address || place.name || "";

    if (type === "from") {
      try { setOrigin(formatted, coords); } catch { setOrigin(formatted); }
      try { setOriginCoords && setOriginCoords(coords); } catch {}
      setMarker("from", coords);
    } else {
      try { setDestination(formatted, coords); } catch { setDestination(formatted); }
      try { setDestinationCoords && setDestinationCoords(coords); } catch {}
      setMarker("to", coords);
    }

    fitToMarkers();
    maybeComputeDistance();
  }

  function geocodeAndSet(geocoder, address, type) {
    geocoder.geocode({ address }, (res, status) => {
      if (status === "OK" && res[0]) {
        const loc = res[0].geometry.location;
        const coords = { lat: loc.lat(), lng: loc.lng(), placeId: "" }; // sin place_id garantizado
        setMarker(type, coords);

        if (type === "from") {
          try {
            if (!state.originCoords) {
              setOrigin(state.origin || address, coords);
              setOriginCoords && setOriginCoords(coords);
            }
          } catch {}
        } else {
          try {
            if (!state.destinationCoords) {
              setDestination(state.destination || address, coords);
              setDestinationCoords && setDestinationCoords(coords);
            }
          } catch {}
        }
        fitToMarkers();
        maybeComputeDistance();
      }
    });
  }

  function setMarker(type, coords) {
    const google = window.google;
    const map = mapObjRef.current;
    if (!map) return;

    if (!markersRef.current[type]) {
      markersRef.current[type] = new google.maps.Marker({
        map,
        position: coords,
        label: type === "from" ? "A" : "B",
      });
    } else {
      markersRef.current[type].setPosition(coords);
    }
  }

  function fitToMarkers() {
    const map = mapObjRef.current;
    if (!map) return;
    const { from, to } = markersRef.current;

    const bounds = new window.google.maps.LatLngBounds();
    let hasAny = false;

    if (from) { bounds.extend(from.getPosition()); hasAny = true; }
    if (to)   { bounds.extend(to.getPosition());   hasAny = true; }
    if (!hasAny) return;

    if (from && to) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    } else {
      map.setCenter((from || to).getPosition());
      map.setZoom(14);
    }
  }

  function maybeComputeDistance() {
    const google = window.google;
    const { from, to } = markersRef.current;
    if (!from || !to) return;

    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [from.getPosition()],
        destinations: [to.getPosition()],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
      },
      (res, status) => {
        if (status !== "OK") return;
        const el = res?.rows?.[0]?.elements?.[0];
        if (el?.status === "OK") {
          const meters = el.distance?.value ?? 0;
          const kmNum = meters / 1000;
          try { setKm(kmNum.toFixed(2)); } catch { setKm(kmNum); }
        }
      }
    );
  }

  // ACEPTAR cotización desde el botón (consolida quote y navega)
  const handleAcceptQuote = ({ price, breakdown } = {}) => {
    if (typeof setQuote === "function") {
      setQuote({
        km: state.km,
        total: price ?? state.price,
        breakdown: breakdown || null,
      });
    } else {
      if (typeof setPrice === "function" && price != null) setPrice(price);
    }

    // Construir y loguear borrador de orden antes de ir a /flow/datos
    const draft = typeof buildOrder === "function" ? buildOrder() : {
      origin: state.origin,
      originCoords: state.originCoords,
      destination: state.destination,
      destinationCoords: state.destinationCoords,
      km: state.km,
      price: price ?? state.price,
      serviceType: state.serviceType,
      surcharge: state.surcharge,
    };
    console.log("[ENVIAR] Draft order →", draft);

    navigate("/flow/datos");
  };

  return (
    <div className={styles.screen}>
      <FlowHeader title="Envíos" />

      {/* Mapa */}
      <section className={styles.mapOuter} aria-label="Mapa">
        <div className={styles.mapWrap}>
          <div ref={mapRef} className={styles.map} />
        </div>
      </section>

      {/* Bottom sheet con inputs */}
      <section className={styles.sheet} aria-label="Datos del envío">
        <div className={styles.grabber} aria-hidden="true" />

        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="from">Origen</label>
            <input
              id="from"
              ref={fromInputRef}
              type="text"
              className={styles.input}
              placeholder="Dirección de retiro"
              value={state.origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="to">Destino</label>
            <input
              id="to"
              ref={toInputRef}
              type="text"
              className={styles.input}
              placeholder="Dirección de entrega"
              value={state.destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          {/* Botón -> abre bottom sheet de resumen/cálculo */}
          <ButonCalculo
            serviceType={state.serviceType}
            origin={state.origin}
            destination={state.destination}
            km={state.km}
            ratePerKm={1000}

            // 👇 nuevos props opcionales (si no los usás, no pasa nada)
            baseRate={0}
            minFare={0}
            serviceSurcharge={state.surcharge}

            onAccept={handleAcceptQuote}
          />
        </div>
      </section>
    </div>
  );
}
