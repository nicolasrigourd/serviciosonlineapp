// src/pages/MisDirecciones/MisDirecciones.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "../../components/BottomNav/BottomNav";
import CardDirecciones from "../../components/CardDirecciones/CardDirecciones";
import { loadGoogleMaps } from "../../lib/googleMapsLoader";
import { useAuth } from "../../state/AuthProvider";
import {
  addAddress,
  editAddress,
  setDefaultAddress,
  removeAddress,
} from "../../services/addressesService";
import { getQuickSlots, toggleQuickSlot, isQuick } from "../../services/quickSlots";
import styles from "./MisDirecciones.module.css";

export default function MisDirecciones() {
  const { user: ctxUser, setSessionUser } = useAuth();
  const cached = (() => { try { return JSON.parse(localStorage.getItem("SessionUser") || "null"); } catch { return null; } })();
  const currentUser = ctxUser || cached;

  const [sessionUser, setSessionUserState] = useState(currentUser || null);
  const [direcciones, setDirecciones] = useState(Array.isArray(currentUser?.addresses) ? currentUser.addresses : []);
  const [actualTexto, setActualTexto] = useState(currentUser?.direccion || "");
  const [quick, setQuick] = useState(currentUser?.uid ? getQuickSlots(currentUser.uid) : []);

  // Sheet
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form
  const [alias, setAlias] = useState("");
  const [address, setAddress] = useState("");
  const [piso, setPiso] = useState("");
  const [notas, setNotas] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  // Animaciones
  const [animatingIdx, setAnimatingIdx] = useState(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // Maps
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const autoRef = useRef(null);
  const [coords, setCoords] = useState({ lat: -34.6037, lng: -58.3816 });
  const placeIdRef = useRef("");

  // Sync con contexto
  useEffect(() => {
    if (!ctxUser) return;
    setSessionUserState(ctxUser);
    setDirecciones(Array.isArray(ctxUser.addresses) ? ctxUser.addresses : []);
    setActualTexto(ctxUser.direccion || "");
    if (ctxUser.uid) setQuick(getQuickSlots(ctxUser.uid));
  }, [ctxUser]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Cerrar sheet con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const resetForm = () => {
    setAlias("");
    setAddress("");
    setPiso("");
    setNotas("");
    setIsDefault(true);
    setEditingId(null);
    placeIdRef.current = "";
    setCoords({ lat: -34.6037, lng: -58.3816 });
  };

  const openSheetForCreate = () => {
    resetForm();
    setOpen(true);
  };

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

  const closeSheet = () => setOpen(false);

  // Init Google Maps cuando el sheet abre
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    let google;

    async function init() {
      if (!apiKey) return;
      google = await loadGoogleMaps(apiKey);
      if (!isMounted) return;

      // Map
      mapObjRef.current = new google.maps.Map(mapRef.current, {
        center: coords,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Marker draggable
      markerRef.current = new google.maps.Marker({
        map: mapObjRef.current,
        position: coords,
        draggable: true,
      });

      // Autocomplete
      const input = document.getElementById("addrInput");
      autoRef.current = new google.maps.places.Autocomplete(input, {
        fields: ["place_id", "geometry", "formatted_address", "name"],
        componentRestrictions: { country: ["ar"] },
      });

      const placeChanged = () => {
        const place = autoRef.current.getPlace();
        if (!place || !place.geometry) return;
        const loc = place.geometry.location;
        const pos = { lat: loc.lat(), lng: loc.lng() };
        setCoords(pos);
        mapObjRef.current.setCenter(pos);
        markerRef.current.setPosition(pos);
        setAddress(place.formatted_address || place.name || "");
        placeIdRef.current = place.place_id || "";
      };

      autoRef.current.addListener("place_changed", placeChanged);

      // Drag end -> reverse geocode
      const onDragEnd = () => {
        const pos = markerRef.current.getPosition();
        const p = { lat: pos.lat(), lng: pos.lng() };
        setCoords(p);
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: p }, (res, status) => {
          if (status === "OK" && res[0]) {
            setAddress(res[0].formatted_address || "");
            placeIdRef.current = res[0].place_id || placeIdRef.current || "";
          }
        });
      };

      markerRef.current.addListener("dragend", onDragEnd);
    }

    init().catch(console.error);

    // Cleanup fuerte para evitar fugas
    return () => {
      isMounted = false;
      try {
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        if (mapObjRef.current) {
          mapObjRef.current = null;
        }
        autoRef.current = null;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apiKey]);

  const handleGuardar = async () => {
    if (!address.trim()) return alert("Ingresá una dirección.");
    if (!currentUser?.uid) return alert("No hay sesión activa.");

    try {
      let next;

      if (editingId) {
        const patch = {
          label: alias || "Dirección",
          alias,
          address: address.trim(),
          piso: piso.trim(),
          notas: notas.trim(),
          lat: coords.lat,
          lng: coords.lng,
          placeId: placeIdRef.current || "",
          isDefault,
        };
        next = await editAddress(currentUser.uid, editingId, patch, sessionUser || currentUser);
      } else {
        const payload = {
          id: (crypto.randomUUID?.() ? crypto.randomUUID() : `DIR-${Date.now()}`),
          label: alias || "Dirección",
          alias,
          address: address.trim(),
          piso: piso.trim(),
          notas: notas.trim(),
          lat: coords.lat,
          lng: coords.lng,
          placeId: placeIdRef.current || "",
          isDefault,
        };
        next = await addAddress(currentUser.uid, payload, sessionUser || currentUser);
      }

      if (setSessionUser) setSessionUser(next);
      setSessionUserState(next);
      setDirecciones(Array.isArray(next.addresses) ? next.addresses : []);
      setActualTexto(next.direccion || "");

      alert("Dirección guardada.");
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la dirección. Intentá nuevamente.");
    }
  };

  const handleSelectCurrentById = async (addressId) => {
    if (!currentUser?.uid) return;
    try {
      const next = await setDefaultAddress(currentUser.uid, addressId, sessionUser || currentUser);
      if (setSessionUser) setSessionUser(next);
      setSessionUserState(next);
      setDirecciones(Array.isArray(next.addresses) ? next.addresses : []);
      setActualTexto(next.direccion || "");
    } catch (e) {
      console.error(e);
      alert("No se pudo establecer como dirección actual.");
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

  const handleDelete = async (addressId) => {
    if (!currentUser?.uid) return;

    // ⛔ No permitir borrar la única dirección
    if (direcciones.length <= 1) {
      alert("Necesitás al menos una dirección guardada.");
      return;
    }

    if (!confirm("¿Eliminar esta dirección?")) return;

    try {
      const next = await removeAddress(currentUser.uid, addressId, sessionUser || currentUser);
      if (setSessionUser) setSessionUser(next);
      setSessionUserState(next);
      setDirecciones(Array.isArray(next.addresses) ? next.addresses : []);
      setActualTexto(next.direccion || "");
      // limpiar quick slot si estaba
      if (currentUser?.uid) {
        const after = toggleQuickSlot(currentUser.uid, addressId);
        setQuick(after);
      }
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar la dirección.");
    }
  };

  const handleToggleQuick = (addressId) => {
    if (!currentUser?.uid) return;
    const after = toggleQuickSlot(currentUser.uid, addressId);
    setQuick(after);
  };

  const defaultAddr = useMemo(() => {
    if (!Array.isArray(direcciones)) return null;
    return direcciones.find(a => a?.isDefault) || null;
  }, [direcciones]);

  const otrasDirecciones = useMemo(() => {
    if (!Array.isArray(direcciones)) return [];
    return direcciones.filter(a => !a?.isDefault);
  }, [direcciones]);

  // Si estás editando y sólo existe una dirección, deshabilitá el checkbox
  const isOnlyAddr = editingId && direcciones.length === 1;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mis direcciones</h1>
        <p className={styles.subtitle}>Gestioná tus direcciones guardadas</p>
      </header>

      <main className={styles.main}>
        {/* Dirección actual */}
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
              quick={defaultAddr ? isQuick(currentUser?.uid, defaultAddr.id) : false}
            />
          </div>
        </section>

        {/* Otras direcciones */}
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
                    quick={isQuick(currentUser?.uid, a.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Barra de acción fija */}
      <div className={styles.actionBar}>
        <button type="button" className={styles.addBtn} onClick={openSheetForCreate}>
          + Agregar nueva dirección
        </button>
      </div>

      {/* Sheet */}
      {open && (
        <>
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "Editar dirección" : "Agregar dirección"}
          >
            <div className={styles.sheetHeader}>
              <div className={styles.grabber} />
              <h3 className={styles.sheetTitle}>{editingId ? "Editar dirección" : "Nueva dirección"}</h3>
              <button type="button" className={styles.closeBtn} onClick={closeSheet} aria-label="Cerrar">✕</button>
            </div>

            <div className={styles.sheetBody}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="alias">Alias (ej: Trabajo, Local)</label>
                <input id="alias" className={styles.input} type="text" value={alias} onChange={(e)=>setAlias(e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="addrInput">Dirección</label>
                <input
                  id="addrInput"
                  className={styles.input}
                  type="text"
                  placeholder="Calle y número"
                  value={address}
                  onChange={(e)=>setAddress(e.target.value)}
                />
              </div>

              <div className={styles.mapWrap}>
                <div ref={mapRef} className={styles.map} />
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="piso">Piso / Dpto</label>
                  <input id="piso" className={styles.input} type="text" value={piso} onChange={(e)=>setPiso(e.target.value)} />
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
                <textarea id="notas" className={styles.textarea} rows={2} value={notas} onChange={(e)=>setNotas(e.target.value)} placeholder="Aclaraciones para el repartidor (opcional)" />
              </div>

              <label className={styles.chk}>
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e)=>setIsDefault(e.target.checked)}
                  disabled={isOnlyAddr}              // ⛔ no destildar si es la única
                />
                <span>Usar como dirección actual</span>
              </label>
            </div>

            <div className={styles.sheetActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeSheet}>Cancelar</button>
              <button type="button" className={styles.saveBtn} onClick={handleGuardar}>
                {editingId ? "Guardar cambios" : "Guardar"}
              </button>
            </div>
          </div>

          <div className={styles.overlay} onClick={closeSheet} />
        </>
      )}

      <BottomNav />
    </div>
  );
}
