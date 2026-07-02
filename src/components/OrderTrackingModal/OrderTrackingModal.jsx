import React, { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ref as rtdbRef, onValue, off } from "firebase/database";
import { db, rtdb } from "../../services/firebase";
import { loadGoogleMaps } from "../../lib/googleMapsLoader";
import { patchOrderDb } from "../../lib/pedidosStore";
import ArrivalAlert from "../ArrivalAlert/ArrivalAlert";
import styles from "./OrderTrackingModal.module.css";

const GMAPS_KEY    = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const OSRM_BASE    = "https://router.project-osrm.org/route/v1/driving";
const ARRIVAL_DIST = 300; // metros — umbral para mostrar ArrivalAlert

// ─── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s) => String(s || "").toLowerCase().trim();

function haversineMeters(a, b) {
  if (!a?.lat || !b?.lat) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function fetchOsrmEta(from, to) {
  if (!from?.lat || !to?.lat) return null;
  try {
    const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const secs = data.routes?.[0]?.duration;
    if (!secs) return null;
    return Math.max(1, Math.ceil(secs / 60));
  } catch {
    return null;
  }
}

function getDriverId(order) {
  return (
    order?.assignment?.assignedDriverId ||
    order?.assignedDriverId ||
    order?.assignment?.assignedDriver?.id ||
    null
  );
}

function getNextWaypoint(order) {
  const step = norm(order?.delivery?.currentStep || "");
  if (step === "go_to_dropoff" || step === "arrived_dropoff") {
    return order?.dropoff?.coords;
  }
  return order?.pickup?.coords;
}

function getNextWaypointLabel(order) {
  const step = norm(order?.delivery?.currentStep || "");
  return step === "go_to_dropoff" || step === "arrived_dropoff"
    ? "al destino"
    : "al origen";
}

function getDriverName(order) {
  const d = order?.assignment?.assignedDriver;
  if (!d) return "Repartidor";
  return [d.firstName, d.lastName].filter(Boolean).join(" ") || d.fullName || "Repartidor";
}

function getDriverVehicle(order) {
  const d = order?.assignment?.assignedDriver;
  return d?.mobility || d?.movilidad || "";
}

function getStatusText(order) {
  const status = norm(order?.status);
  const step   = norm(order?.delivery?.currentStep || "");
  if (status === "pending" || status === "pendiente") return "Buscando repartidor…";
  if (status === "offering" || status === "ofertando") return "Esperando respuesta del repartidor";
  if (step === "started_pickup")   return "El repartidor va al punto de retiro";
  if (step === "arrived_pickup")   return "El repartidor llegó al punto de retiro";
  if (step === "go_to_dropoff")    return "El repartidor va al destino";
  if (step === "arrived_dropoff")  return "El repartidor llegó al destino";
  if (status === "assigned" || status === "asignado") return "Repartidor asignado";
  if (status === "completed" || status === "delivered") return "Pedido entregado";
  return "Pedido en curso";
}

function shortId(id) {
  const v = String(id || "");
  return v.length > 8 ? `#${v.slice(-6)}` : `#${v}`;
}

const STEPS = [
  { key: "created",  label: "Pedido recibido" },
  { key: "assigned", label: "Repartidor asignado" },
  { key: "pickup",   label: "Retiro" },
  { key: "dropoff",  label: "Entrega" },
];

function getCurrentStepIndex(order) {
  const status = norm(order?.status);
  const step   = norm(order?.delivery?.currentStep || "");
  if (status === "completed" || status === "delivered") return 4;
  if (step === "go_to_dropoff" || step === "arrived_dropoff") return 3;
  if (step === "started_pickup" || step === "arrived_pickup") return 2;
  if (status === "assigned" || status === "asignado") return 1;
  return 0;
}

const DARK_MAP_STYLE = [
  { elementType: "geometry",        stylers: [{ color: "#1A1D26" }] },
  { elementType: "labels.icon",     stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill",stylers: [{ color: "#6B7280" }] },
  { elementType: "labels.text.stroke",stylers:[{ color: "#161B22" }] },
  { featureType: "poi",             stylers: [{ visibility: "off" }] },
  { featureType: "road",            elementType: "geometry",         stylers: [{ color: "#2d3848" }] },
  { featureType: "road.highway",    elementType: "geometry",         stylers: [{ color: "#3d4f64" }] },
  { featureType: "transit",         stylers: [{ visibility: "off" }] },
  { featureType: "water",           elementType: "geometry",         stylers: [{ color: "#0D1117" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#D1D5DB" }] },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderTrackingModal({ orderId, onClose }) {
  const mapDivRef      = useRef(null);
  const mapRef         = useRef(null);
  const driverMarkerRef= useRef(null);
  const pickupMarkerRef= useRef(null);
  const dropoffMarkerRef= useRef(null);
  const routeLineRef   = useRef(null);
  const etaThrottleRef = useRef(null);

  const [order,       setOrder]       = useState(null);
  const [driverLoc,   setDriverLoc]   = useState(null);
  const [etaMinutes,  setEtaMinutes]  = useState(null);
  const [panelMode,   setPanelMode]   = useState("compact"); // compact | expanded
  const [showArrival, setShowArrival] = useState(false);

  // ── Firestore listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, "orders", orderId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const merged = { ...data, orderId: data.orderId || snap.id };
      setOrder(merged);
      patchOrderDb(orderId, merged).catch(() => {});
    });
    return () => unsub();
  }, [orderId]);

  // ── RTDB listener (driver location) ────────────────────────────────────────
  useEffect(() => {
    const driverId = getDriverId(order);
    if (!driverId) return;

    const locRef = rtdbRef(rtdb, `/driversLive/${driverId}`);
    const handle = onValue(locRef, (snap) => {
      const val = snap.val();
      if (val?.lat && val?.lng) {
        setDriverLoc({ lat: Number(val.lat), lng: Number(val.lng) });
      }
    });

    return () => off(locRef, "value", handle);
  }, [order?.assignment?.assignedDriverId, order?.assignedDriverId]);

  // ── OSRM ETA (throttled: máximo 1 req cada 15s) ─────────────────────────────
  useEffect(() => {
    if (!driverLoc || !order) return;

    const waypoint = getNextWaypoint(order);

    // Arrival alert
    const dist = haversineMeters(driverLoc, waypoint);
    setShowArrival(dist < ARRIVAL_DIST);

    // Throttle OSRM calls
    clearTimeout(etaThrottleRef.current);
    etaThrottleRef.current = setTimeout(async () => {
      const eta = await fetchOsrmEta(driverLoc, waypoint);
      setEtaMinutes(eta);
    }, 15_000);

    // First call without delay
    fetchOsrmEta(driverLoc, waypoint).then(setEtaMinutes);

    return () => clearTimeout(etaThrottleRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLoc]);

  // ── Google Maps init ────────────────────────────────────────────────────────
  const initMap = useCallback(async () => {
    if (!mapDivRef.current || mapRef.current) return;
    const google = await loadGoogleMaps(GMAPS_KEY);
    const isDark  = document.documentElement.getAttribute("data-theme") === "dark";

    mapRef.current = new google.maps.Map(mapDivRef.current, {
      zoom: 14,
      center: { lat: -27.7834, lng: -64.2642 },
      styles: isDark ? DARK_MAP_STYLE : [],
      disableDefaultUI: true,
      gestureHandling: "greedy",
    });
  }, []);

  useEffect(() => { initMap(); }, [initMap]);

  // ── Pines estáticos pickup / dropoff ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !order) return;
    const google = window.google;
    if (!google) return;

    const pickup  = order.pickup?.coords;
    const dropoff = order.dropoff?.coords;

    if (pickup?.lat && !pickupMarkerRef.current) {
      pickupMarkerRef.current = new google.maps.Marker({
        position: pickup,
        map: mapRef.current,
        title: "Origen",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#6366f1",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
    }

    if (dropoff?.lat && !dropoffMarkerRef.current) {
      dropoffMarkerRef.current = new google.maps.Marker({
        position: dropoff,
        map: mapRef.current,
        title: "Destino",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#f43f5e",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
    }

    // Línea punteada entre pickup y dropoff
    if (pickup?.lat && dropoff?.lat && !routeLineRef.current) {
      routeLineRef.current = new google.maps.Polyline({
        path: [pickup, dropoff],
        geodesic: true,
        strokeColor: "#6366f1",
        strokeOpacity: 0,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 0.7, scale: 3 },
          offset: "0",
          repeat: "14px",
        }],
        map: mapRef.current,
      });
    }

    // Fit bounds
    if (pickup?.lat && dropoff?.lat) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(dropoff);
      mapRef.current.fitBounds(bounds, { top: 60, bottom: 200, left: 40, right: 40 });
    } else if (pickup?.lat) {
      mapRef.current.setCenter(pickup);
      mapRef.current.setZoom(15);
    }
  }, [order]);

  // ── Pin del repartidor (mueve en tiempo real) ───────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !driverLoc) return;
    const google = window.google;
    if (!google) return;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: driverLoc,
        map: mapRef.current,
        title: "Repartidor",
        zIndex: 10,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          rotation: 0,
        },
      });
    } else {
      driverMarkerRef.current.setPosition(driverLoc);
    }

    // Centra el mapa suavemente en el repartidor
    mapRef.current.panTo(driverLoc);
  }, [driverLoc]);

  // ── Cleanup markers on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      [driverMarkerRef, pickupMarkerRef, dropoffMarkerRef, routeLineRef].forEach((r) => {
        r.current?.setMap?.(null);
        r.current = null;
      });
    };
  }, []);

  // ── Drag panel ──────────────────────────────────────────────────────────────
  const dragRef = useRef({ startY: 0, dragging: false });

  const onPanelPointerDown = (e) => {
    dragRef.current = { startY: e.clientY, dragging: true };
  };
  const onPanelPointerUp = (e) => {
    if (!dragRef.current.dragging) return;
    const diff = e.clientY - dragRef.current.startY;
    if (diff < -40) setPanelMode("expanded");
    if (diff >  40) setPanelMode("compact");
    dragRef.current.dragging = false;
  };

  const driverName    = order ? getDriverName(order) : "—";
  const driverVehicle = order ? getDriverVehicle(order) : "";
  const statusText    = order ? getStatusText(order) : "Cargando…";
  const stepIndex     = order ? getCurrentStepIndex(order) : 0;
  const waypointLabel = order ? getNextWaypointLabel(order) : "";
  const hasDriver     = Boolean(getDriverId(order));

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      {/* Arrival alert */}
      {showArrival && <ArrivalAlert />}

      {/* Header */}
      <div className={styles.header}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          {closeIcon}
        </button>
        <span className={styles.headerTitle}>{shortId(orderId)}</span>
        <span />
      </div>

      {/* Mapa */}
      <div className={styles.mapWrap}>
        <div ref={mapDivRef} className={styles.map} />
        {!hasDriver && (
          <div className={styles.mapOverlay}>
            <div className={styles.radarPulse} />
            <p>{statusText}</p>
          </div>
        )}
      </div>

      {/* Panel inferior */}
      <div
        className={`${styles.panel} ${styles[panelMode]}`}
        onPointerDown={onPanelPointerDown}
        onPointerUp={onPanelPointerUp}
        onPointerCancel={onPanelPointerUp}
      >
        <div className={styles.handle} />

        <div className={styles.panelTop}>
          <div className={styles.driverInfo}>
            <div className={styles.avatar}>{driverName.charAt(0).toUpperCase()}</div>
            <div>
              <strong className={styles.driverName}>{driverName}</strong>
              {driverVehicle && <span className={styles.vehicle}>{driverVehicle}</span>}
            </div>
          </div>

          {etaMinutes !== null ? (
            <div className={styles.etaChip}>
              {clockIcon}
              <span>~{etaMinutes} min {waypointLabel}</span>
            </div>
          ) : hasDriver ? (
            <div className={styles.etaChip}>
              {clockIcon}
              <span>Calculando…</span>
            </div>
          ) : null}
        </div>

        <p className={styles.statusText}>{statusText}</p>

        {/* Timeline — visible en modo expanded */}
        <div className={styles.timeline}>
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`${styles.step} ${i < stepIndex ? styles.stepDone : ""} ${i === stepIndex ? styles.stepActive : ""}`}
            >
              <span className={styles.stepCircle}>{i < stepIndex ? "✓" : i === stepIndex ? "●" : ""}</span>
              <span className={styles.stepLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const closeIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

const clockIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);
