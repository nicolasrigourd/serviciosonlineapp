// src/pages/MisDirecciones/MisDirecciones.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import BottomNav from "../../components/BottomNav/BottomNav";
import CardDirecciones from "../../components/CardDirecciones/CardDirecciones";
import ToastStack from "../../components/Toast/ToastStack";
import { loadGoogleMaps } from "../../lib/googleMapsLoader";
import { useAuth } from "../../state/AuthProvider";
import { clienteDb } from "../../db/clienteDb";
import {
  addAddress,
  editAddress,
  setDefaultAddress,
  removeAddress,
} from "../../services/addressesService";
import { getQuickSlots, toggleQuickSlot, isQuick } from "../../services/quickSlots";
import { useToast } from "../../hooks/useToast";
import styles from "./MisDirecciones.module.css";

export default function MisDirecciones() {
  const { user, setSessionUser } = useAuth();

  // ── Datos reactivos desde IndexedDB ───────────────────────────
  const profile = useLiveQuery(() => clienteDb.profile.get("me"), []);
  const direcciones = useMemo(
    () => (Array.isArray(profile?.addresses) ? profile.addresses : []),
    [profile]
  );
  const actualTexto = profile?.direccion || "";
  const uid = user?.uid || profile?.uid;

  const { toasts, show: showToast } = useToast();

  // Quick slots (localStorage — pendiente de migrar)
  const [quick, setQuick] = useState(uid ? getQuickSlots(uid) : []);
  useEffect(() => {
    if (uid) setQuick(getQuickSlots(uid));
  }, [uid]);

  // ── Sheet state ────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // ── Confirm delete ─────────────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState(null);

  // ── Form state ─────────────────────────────────────────────────
  const [alias, setAlias] = useState("");
  const [address, setAddress] = useState("");
  const [piso, setPiso] = useState("");
  const [notas, setNotas] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  // ── Animaciones ────────────────────────────────────────────────
  const [animatingIdx, setAnimatingIdx] = useState(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // ── Google Maps ────────────────────────────────────────────────
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const autoRef = useRef(null);
  const [coords, setCoords] = useState({ lat: -34.6037, lng: -58.3816 });
  const placeIdRef = useRef("");

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const resetForm = () => {
    setAlias(""); setAddress(""); setPiso(""); setNotas("");
    setIsDefault(true); setEditingId(null);
    placeIdRef.current = "";
    setCoords({ lat: -34.6037, lng: -58.3816 });
  };

  const openSheetForCreate = () => { resetForm(); setOpen(true); };

  const openSheetForEdit = (addr) => {
    setEditingId(addr.id);
    setAlias(addr.alias || addr.label || "");
    setAddress(addr.address || "");
    setPiso(addr.piso || "");
    setNotas(addr.notas || "");
    setIsDefault(!!addr.isDefault);
    placeIdRef.current = addr.placeId || "";
    setCoords({
      lat: typeof addr.lat === "number" ? addr.lat : -34.6037,
      lng: typeof addr.lng === "number" ? addr.lng : -58.3816,
    });
    setOpen(true);
  };

  // Init Google Maps
  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    async function init() {
      if (!apiKey) return;
      const google = await loadGoogleMaps(apiKey);
      if (!isMounted) return;

      mapObjRef.current = new google.maps.Map(mapRef.current, {
        center: coords, zoom: 15,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });

      markerRef.current = new google.maps.Marker({
        map: mapObjRef.current, position: coords, draggable: true,
      });

      const input = document.getElementById("addrInput");
      autoRef.current = new google.maps.places.Autocomplete(input, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });

      autoRef.current.addListener("place_changed", () => {
        const place = autoRef.current.getPlace();
        if (!place?.geometry) return;
        const pos = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        setCoords(pos);
        mapObjRef.current.setCenter(pos);
        markerRef.current.setPosition(pos);
        setAddress(place.formatted_address || place.name || "");
        placeIdRef.current = place.place_id || "";
      });

      markerRef.current.addListener("dragend", () => {
        const pos = markerRef.current.getPosition();
        const p = { lat: pos.lat(), lng: pos.lng() };
        setCoords(p);
        new google.maps.Geocoder().geocode({ location: p }, (res, status) => {
          if (status === "OK" && res[0]) {
            setAddress(res[0].formatted_address || "");
            placeIdRef.current = res[0].place_id || placeIdRef.current || "";
          }
        });
      });
    }

    init().catch(console.error);
    return () => {
      isMounted = false;
      try {
        if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
        mapObjRef.current = null;
        autoRef.current = null;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apiKey]);

  // ── Acciones ───────────────────────────────────────────────────

  const handleGuardar = async () => {
    if (!address.trim()) { showToast("Ingresá una dirección.", "error"); return; }
    if (!uid) { showToast("No hay sesión activa.", "error"); return; }

    try {
      let next;
      if (editingId) {
        next = await editAddress(uid, editingId, {
          label: alias || "Dirección", alias,
          address: address.trim(), piso: piso.trim(), notas: notas.trim(),
          lat: coords.lat, lng: coords.lng,
          placeId: placeIdRef.current || "", isDefault,
        });
      } else {
        next = await addAddress(uid, {
          id: crypto.randomUUID?.() || `DIR-${Date.now()}`,
          label: alias || "Dirección", alias,
          address: address.trim(), piso: piso.trim(), notas: notas.trim(),
          lat: coords.lat, lng: coords.lng,
          placeId: placeIdRef.current || "", isDefault,
        });
      }
      setSessionUser(next);
      showToast(editingId ? "Dirección actualizada." : "Dirección guardada.");
      setOpen(false);
    } catch (e) {
      console.error(e);
      showToast("No se pudo guardar. Intentá nuevamente.", "error");
    }
  };

  const handleSelectCurrentById = async (addressId) => {
    if (!uid) return;
    try {
      const next = await setDefaultAddress(uid, addressId);
      setSessionUser(next);
    } catch (e) {
      console.error(e);
      showToast("No se pudo establecer como dirección actual.", "error");
    }
  };

  const handleAnimateSelect = (addressId, idx) => {
    if (isSwapping) return;
    setAnimatingIdx(idx);
    setIsSwapping(true);
    setTimeout(async () => {
      await handleSelectCurrentById(addressId);
      setAnimatingIdx(null);
      setIsSwapping(false);
    }, 520);
  };

  const handleDelete = (addressId) => {
    if (!uid) return;
    if (direcciones.length <= 1) {
      showToast("Necesitás al menos una dirección guardada.", "error");
      return;
    }
    const addr = direcciones.find((a) => a.id === addressId);
    setPendingDelete({ id: addressId, label: addr?.alias || addr?.label || "esta dirección" });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      const next = await removeAddress(uid, id);
      setSessionUser(next);
      if (uid) setQuick(toggleQuickSlot(uid, id));
      showToast("Dirección eliminada.");
    } catch (e) {
      console.error(e);
      showToast("No se pudo eliminar la dirección.", "error");
    }
  };

  const handleToggleQuick = (addressId) => {
    if (!uid) return;
    setQuick(toggleQuickSlot(uid, addressId));
  };

  const defaultAddr = useMemo(
    () => direcciones.find((a) => a?.isDefault) || null,
    [direcciones]
  );

  const otrasDirecciones = useMemo(
    () => direcciones.filter((a) => !a?.isDefault),
    [direcciones]
  );

  const isOnlyAddr = editingId && direcciones.length === 1;

  return (
    <div className={styles.screen}>
      <ToastStack toasts={toasts} />

      <header className={styles.header}>
        <h1 className={styles.title}>Mis direcciones</h1>
        <p className={styles.subtitle}>Gestioná tus direcciones guardadas</p>
      </header>

      <main className={styles.main}>
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Dirección actual</h2>
          <div className={`${styles.cardWrap} ${isSwapping ? styles.animDrop : ""}`}>
            <CardDirecciones
              title="En uso"
              address={defaultAddr?.address || actualTexto || "—"}
              piso={defaultAddr?.piso}
              isDefault
              onEdit={() => defaultAddr && openSheetForEdit(defaultAddr)}
              onDelete={() => defaultAddr && handleDelete(defaultAddr.id)}
              onToggleQuick={() => defaultAddr && handleToggleQuick(defaultAddr.id)}
              quick={defaultAddr ? isQuick(uid, defaultAddr.id) : false}
            />
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Otras direcciones</h2>
          {otrasDirecciones.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyCard}>
                <p>Todavía no agregaste direcciones adicionales.</p>
              </div>
            </div>
          ) : (
            <div className={styles.list}>
              {otrasDirecciones.map((a, i) => (
                <div
                  key={a.id}
                  className={`${styles.cardWrap} ${animatingIdx === i ? styles.animPick : ""}`}
                >
                  <CardDirecciones
                    title={a.label || `Guardada #${i + 1}`}
                    address={a.address}
                    piso={a.piso}
                    onEdit={() => openSheetForEdit(a)}
                    onDelete={() => handleDelete(a.id)}
                    onToggleQuick={() => handleToggleQuick(a.id)}
                    onSelectCurrent={() => handleAnimateSelect(a.id, i)}
                    quick={isQuick(uid, a.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className={styles.actionBar}>
        <button type="button" className={styles.addBtn} onClick={openSheetForCreate}>
          + Agregar nueva dirección
        </button>
      </div>

      {/* Sheet */}
      {open && (
        <>
          <div className={styles.sheet} role="dialog" aria-modal="true"
            aria-label={editingId ? "Editar dirección" : "Agregar dirección"}>
            <div className={styles.sheetHeader}>
              <div className={styles.grabber} />
              <h3 className={styles.sheetTitle}>{editingId ? "Editar dirección" : "Nueva dirección"}</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>

            <div className={styles.sheetBody}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="alias">Alias (ej: Trabajo, Local)</label>
                <input id="alias" className={styles.input} type="text" value={alias} onChange={(e) => setAlias(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="addrInput">Dirección</label>
                <input id="addrInput" className={styles.input} type="text" placeholder="Calle y número"
                  value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className={styles.mapWrap}>
                <div ref={mapRef} className={styles.map} />
              </div>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="piso">Piso / Dpto</label>
                  <input id="piso" className={styles.input} type="text" value={piso} onChange={(e) => setPiso(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Coordenadas</label>
                  <div className={styles.coords}>
                    <span>Lat: {coords.lat.toFixed(5)}</span>
                    <span>Lng: {coords.lng.toFixed(5)}</span>
                  </div>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="notas">Notas</label>
                <textarea id="notas" className={styles.textarea} rows={2} value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Aclaraciones para el repartidor (opcional)" />
              </div>
              <label className={styles.chk}>
                <input type="checkbox" checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)} disabled={isOnlyAddr} />
                <span>Usar como dirección actual</span>
              </label>
            </div>

            <div className={styles.sheetActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setOpen(false)}>Cancelar</button>
              <button type="button" className={styles.saveBtn} onClick={handleGuardar}>
                {editingId ? "Guardar cambios" : "Guardar"}
              </button>
            </div>
          </div>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
        </>
      )}

      {/* Confirm delete */}
      {pendingDelete && (
        <div className={styles.confirmOverlay} onClick={() => setPendingDelete(null)}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIconWrap}>{trashIcon}</div>
            <h3 className={styles.confirmTitle}>¿Eliminar dirección?</h3>
            <p className={styles.confirmText}>
              <strong>"{pendingDelete.label}"</strong> se va a quitar de tus direcciones guardadas.
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmCancel} onClick={() => setPendingDelete(null)}>
                Cancelar
              </button>
              <button type="button" className={styles.confirmDanger} onClick={confirmDelete}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

const trashIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);
