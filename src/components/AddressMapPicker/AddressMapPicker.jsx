import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../../lib/googleMapsLoader";
import styles from "./AddressMapPicker.module.css"
const DEFAULT_CENTER = {
  lat: -27.7833574,
  lng: -64.264167,
};

function hasValidCoords(coords) {
  return (
    coords &&
    Number.isFinite(Number(coords.lat)) &&
    Number.isFinite(Number(coords.lng))
  );
}

function formatCoords(coords) {
  if (!hasValidCoords(coords)) return "";

  return `${Number(coords.lat).toFixed(6)}, ${Number(coords.lng).toFixed(6)}`;
}

export default function AdressMapPicker({
  open,
  initialCoords = null,
  initialAddress = "",
  onClose,
  onConfirm,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const idleListenerRef = useRef(null);

  const [loadingMap, setLoadingMap] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [error, setError] = useState("");
  const [center, setCenter] = useState(() =>
    hasValidCoords(initialCoords) ? initialCoords : DEFAULT_CENTER
  );
  const [address, setAddress] = useState(initialAddress || "");
  const [source, setSource] = useState("manual_map");

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    async function initMap() {
      try {
        setLoadingMap(true);
        setError("");

        if (!apiKey) {
          setError("No está configurada la API Key de Google Maps.");
          return;
        }

        const google = await loadGoogleMaps(apiKey);

        if (!mounted || !mapNodeRef.current) return;

        const startCenter = hasValidCoords(initialCoords)
          ? {
              lat: Number(initialCoords.lat),
              lng: Number(initialCoords.lng),
            }
          : DEFAULT_CENTER;

        setCenter(startCenter);
        setAddress(initialAddress || "");
        setSource(hasValidCoords(initialCoords) ? "autocomplete" : "manual_map");

        geocoderRef.current = new google.maps.Geocoder();

        mapRef.current = new google.maps.Map(mapNodeRef.current, {
          center: startCenter,
          zoom: hasValidCoords(initialCoords) ? 17 : 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        idleListenerRef.current = mapRef.current.addListener("idle", () => {
          const currentCenter = mapRef.current?.getCenter();

          if (!currentCenter) return;

          setCenter({
            lat: currentCenter.lat(),
            lng: currentCenter.lng(),
          });
        });
      } catch (err) {
        console.error("[ADRESS_MAP_PICKER] Error cargando mapa:", err);
        setError("No pudimos cargar el mapa. Intentá nuevamente.");
      } finally {
        if (mounted) setLoadingMap(false);
      }
    }

    initMap();

    return () => {
      mounted = false;

      if (idleListenerRef.current) {
        idleListenerRef.current.remove();
        idleListenerRef.current = null;
      }

      mapRef.current = null;
      geocoderRef.current = null;
    };
  }, [open, apiKey, initialCoords, initialAddress]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const reverseGeocode = async (coords) => {
    if (!geocoderRef.current || !hasValidCoords(coords)) {
      return "";
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
        `Ubicación seleccionada (${formatCoords(coords)})`
      );
    } catch (err) {
      console.warn(
        "[ADRESS_MAP_PICKER] No se pudo obtener dirección aproximada:",
        err
      );

      return `Ubicación seleccionada (${formatCoords(coords)})`;
    }
  };

  const handleUseGps = () => {
    setError("");

    if (!navigator.geolocation) {
      setError("Tu dispositivo no permite obtener ubicación por GPS.");
      return;
    }

    setLoadingGps(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setCenter(coords);
        setSource("gps");

        if (mapRef.current) {
          mapRef.current.setCenter(coords);
          mapRef.current.setZoom(18);
        }

        const formatted = await reverseGeocode(coords);
        setAddress(formatted);

        setLoadingGps(false);
      },
      (err) => {
        console.error("[ADRESS_MAP_PICKER] Error GPS:", err);

        if (err.code === 1) {
          setError("Permiso de ubicación denegado. Podés mover el mapa manualmente.");
        } else if (err.code === 2) {
          setError("No pudimos obtener tu ubicación actual.");
        } else if (err.code === 3) {
          setError("La ubicación tardó demasiado. Intentá nuevamente.");
        } else {
          setError("No pudimos usar el GPS.");
        }

        setLoadingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleConfirm = async () => {
    if (!hasValidCoords(center)) {
      setError("Seleccioná una ubicación válida.");
      return;
    }

    setError("");

    const formattedAddress =
      address ||
      (await reverseGeocode(center)) ||
      `Ubicación seleccionada (${formatCoords(center)})`;

    onConfirm?.({
      address: formattedAddress,
      formatted: formattedAddress,
      lat: Number(center.lat),
      lng: Number(center.lng),
      placeId: "",
      hasGeometry: true,
      source: source || "manual_map",
    });
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <section className={styles.modal}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar selector de ubicación"
          >
            ×
          </button>

          <div>
            <h2>Confirmar ubicación</h2>
            <p>Mové el mapa hasta dejar el pin sobre tu domicilio.</p>
          </div>
        </header>

        <div className={styles.mapWrap}>
          <div ref={mapNodeRef} className={styles.map} />

          <div className={styles.centerPin}>
            <div className={styles.pinHead} />
            <div className={styles.pinShadow} />
          </div>

          {loadingMap && (
            <div className={styles.loadingMap}>
              <span className={styles.spinner} />
              Cargando mapa…
            </div>
          )}
        </div>

        <footer className={styles.sheet}>
          <div className={styles.locationCard}>
            <span className={styles.locationLabel}>Ubicación seleccionada</span>

            <strong>
              {address || "Mové el mapa o usá tu ubicación actual"}
            </strong>

            <small>{formatCoords(center)}</small>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.gpsBtn}
              onClick={handleUseGps}
              disabled={loadingGps || loadingMap}
            >
              {loadingGps ? (
                <>
                  <span className={styles.spinnerDark} />
                  Buscando…
                </>
              ) : (
                "Usar mi ubicación"
              )}
            </button>

            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={loadingMap}
            >
              Confirmar ubicación
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}