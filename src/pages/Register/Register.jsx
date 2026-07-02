import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconCurrentLocation } from "@tabler/icons-react";
import styles from "./Register.module.css";
import { useAuth } from "../../state/AuthProvider";

// Google Maps
import { loadGoogleMaps } from "../../lib/googleMapsLoader";

// Firebase
import { auth, db } from "../../services/firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

// Components
import AdressMapPicker from "../../components/AdressMapPicker/AdressMapPicker";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const submitLockRef = useRef(false);
  const exitTimeoutRef = useRef(null);
  const navTimeoutRef = useRef(null);

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    direccion: "",
    dpto: "",
    descripcionDireccion: "",
    referenciaDireccion: "",
    email: "",
    username: "",
    password: "",
    confirm: "",
  });

  const [dirPlace, setDirPlace] = useState({
    formatted: "",
    lat: null,
    lng: null,
    placeId: "",
    hasGeometry: false,
    source: "",
  });

  const direccionInputRef = useRef(null);
  const autoRef = useRef(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [exiting, setExiting] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!apiKey || !direccionInputRef.current) return;

      const google = await loadGoogleMaps(apiKey);
      if (!isMounted || !direccionInputRef.current) return;

      autoRef.current = new google.maps.places.Autocomplete(
        direccionInputRef.current,
        {
          fields: ["place_id", "geometry", "formatted_address", "name"],
          componentRestrictions: { country: ["ar"] },
        }
      );

      autoRef.current.addListener("place_changed", () => {
        const place = autoRef.current.getPlace();

        if (!place || !place.geometry) {
          setDirPlace({
            formatted: "",
            lat: null,
            lng: null,
            placeId: "",
            hasGeometry: false,
            source: "",
          });
          return;
        }

        const loc = place.geometry.location;
        const formatted = place.formatted_address || place.name || "";
        const lat = loc.lat();
        const lng = loc.lng();

        setForm((prev) => ({ ...prev, direccion: formatted }));
        setDirPlace({
          formatted,
          lat,
          lng,
          placeId: place.place_id || "",
          hasGeometry: true,
          source: "autocomplete",
        });
        setError("");
      });
    }

    init().catch((err) => {
      console.error("[REGISTER] Error inicializando autocomplete:", err);
    });

    return () => {
      isMounted = false;

      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);

      submitLockRef.current = false;
    };
  }, [apiKey]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");

    if (name === "direccion") {
      setDirPlace((prev) => ({
        ...prev,
        hasGeometry: false,
        source: "",
      }));
    }
  };

  const handleMapConfirm = (location) => {
    const formatted =
      location?.formatted ||
      location?.address ||
      `Ubicación seleccionada (${Number(location?.lat).toFixed(6)}, ${Number(
        location?.lng
      ).toFixed(6)})`;

    setForm((prev) => ({
      ...prev,
      direccion: formatted,
    }));

    setDirPlace({
      formatted,
      lat: Number(location.lat),
      lng: Number(location.lng),
      placeId: location.placeId || "",
      hasGeometry: true,
      source: location.source || "manual_map",
    });

    setMapOpen(false);
    setError("");
  };

  const handleGetLocation = async () => {
    if (locating) return;
    setLocating(true);
    setError("");

    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();

      if (perm.location === "denied") {
        setError("Permiso de ubicación denegado. Habilitalo en la configuración del dispositivo o escribí tu dirección.");
        setLocating(false);
        return;
      }

      if (perm.location !== "granted") {
        const req = await Geolocation.requestPermissions({ permissions: ["location"] });
        if (req.location !== "granted") {
          setError("Necesitamos permiso de ubicación para usar esta función.");
          setLocating(false);
          return;
        }
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // Reverse geocode con Google Maps
      const google = await loadGoogleMaps(apiKey);
      const geocoder = new google.maps.Geocoder();
      const { results } = await geocoder.geocode({ location: { lat, lng } });

      if (!results || results.length === 0) {
        setError("No encontramos una dirección para tu ubicación. Completala manualmente.");
        setLocating(false);
        return;
      }

      const formatted = results[0].formatted_address;

      setForm((prev) => ({ ...prev, direccion: formatted }));
      setDirPlace({
        formatted,
        lat,
        lng,
        placeId: results[0].place_id || "",
        hasGeometry: true,
        source: "gps",
      });
      setError("");
    } catch (err) {
      console.error("[LOCATION]", err);
      const code = err?.code ?? err?.message ?? "";
      if (String(code).includes("1") || String(code).toLowerCase().includes("denied")) {
        setError("Permiso de ubicación denegado. Podés escribir tu dirección manualmente.");
      } else {
        setError("No pudimos obtener tu ubicación. Intentá de nuevo.");
      }
    } finally {
      setLocating(false);
    }
  };

  const genUserNumber = () =>
    String(Math.floor(100000 + Math.random() * 900000));

  const releaseLock = () => {
    submitLockRef.current = false;
  };

  const getFirebaseErrorMessage = (err) => {
    if (err?.message === "USERNAME_TAKEN") {
      return "Ese nombre de usuario ya existe.";
    }

    switch (err?.code) {
      case "auth/email-already-in-use":
        return "Ese email ya está registrado.";
      case "auth/invalid-email":
        return "Ingresá un email válido.";
      case "auth/weak-password":
        return "La contraseña es demasiado débil.";
      case "auth/network-request-failed":
        return "No pudimos conectar. Revisá tu conexión a internet.";
      case "permission-denied":
        return "Permisos insuficientes en Firestore.";
      default:
        break;
    }

    if (String(err).includes("auth/email-already-in-use")) {
      return "Ese email ya está registrado.";
    }

    if (String(err).includes("Missing or insufficient permissions")) {
      return "Permisos insuficientes en Firestore: revisá las reglas o el orden de escritura.";
    }

    return "No se pudo crear el usuario. Intentá nuevamente.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    const required = [
      "nombre",
      "apellido",
      "telefono",
      "direccion",
      "email",
      "username",
      "password",
      "confirm",
    ];

    for (const key of required) {
      if (!String(form[key] ?? "").trim()) {
        setError("Completá todos los campos obligatorios.");
        releaseLock();
        return;
      }
    }

    if (!dirPlace.hasGeometry) {
      setError("Confirmá una ubicación válida usando el listado o el mapa.");
      releaseLock();
      return;
    }

    const addressSource = dirPlace.source || "";

    if (
      ["gps", "manual_map"].includes(addressSource) &&
      !String(form.descripcionDireccion || "").trim()
    ) {
      setError("Agregá una descripción del domicilio, por ejemplo barrio, manzana, lote o referencia de la casa.");
      releaseLock();
      return;
    }

    const mailRx = /^\S+@\S+\.\S+$/;
    if (!mailRx.test(form.email.trim())) {
      setError("Ingresá un email válido.");
      releaseLock();
      return;
    }

    const digitsOnly = (form.telefono || "").replace(/\D/g, "");
    if (digitsOnly.length < 6) {
      setError("Ingresá un teléfono válido, solo números, sin 0 y sin 15.");
      releaseLock();
      return;
    }

    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      releaseLock();
      return;
    }

    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden.");
      releaseLock();
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const usernameKey = form.username.trim().toLowerCase();
      const emailNorm = form.email.trim().toLowerCase();

      const preRef = doc(db, "usernames", usernameKey);
      const preSnap = await getDoc(preRef);

      if (preSnap.exists()) {
        setSubmitting(false);
        releaseLock();
        setError("Ese nombre de usuario ya existe.");
        return;
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        emailNorm,
        form.password
      );

      await updateProfile(cred.user, {
        displayName: `${form.nombre.trim()} ${form.apellido.trim()}`,
      });

      const usernameRef = doc(db, "usernames", usernameKey);

      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(usernameRef);

          if (snap.exists()) {
            throw new Error("USERNAME_TAKEN");
          }

          tx.set(usernameRef, {
            uid: cred.user.uid,
            email: emailNorm,
            reservedAt: serverTimestamp(),
          });
        });
      } catch (txErr) {
        try {
          await deleteUser(cred.user);
        } catch (deleteErr) {
          console.warn("[REGISTER] No se pudo revertir Auth:", deleteErr);
        }

        throw txErr;
      }

      const primaryAddress = (dirPlace.formatted || form.direccion).trim();
      const dpto = (form.dpto || "").trim();
      const descripcionDireccion = (form.descripcionDireccion || "").trim();
      const referenciaDireccion = (form.referenciaDireccion || "").trim();

      const userDocRef = doc(db, "userswebapp", cred.user.uid);

      const userData = {
        uid: cred.user.uid,
        userNumber: genUserNumber(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: digitsOnly,
        email: emailNorm,
        username: usernameKey,
        createdAt: serverTimestamp(),

        direccion: primaryAddress,
        direccion2: "",
        direccion3: "",
        direccion4: "",
        direccion5: "",

        dpto,
        direccionDescripcion: descripcionDireccion,
        direccionReferencia: referenciaDireccion,

        addresses: [
          {
            id: `DIR-${Date.now()}`,
            label: "Principal",
            alias: "Principal",

            address: primaryAddress,
            addressSource: dirPlace.source || "autocomplete",

            lat: dirPlace.lat,
            lng: dirPlace.lng,
            placeId: dirPlace.placeId || "",

            piso: dpto,
            descripcion: descripcionDireccion,
            referencia: referenciaDireccion,
            notas: referenciaDireccion,

            isDefault: true,
          },
        ],
      };

      await setDoc(userDocRef, userData, { merge: true });

      setSuccess(true);
      setSubmitting(false);

      try {
        await login(usernameKey, form.password);
      } catch {
        // Si el auto-login falla, mandamos al login manual
        navigate("/login", { replace: true });
        return;
      }

      exitTimeoutRef.current = setTimeout(() => {
        setExiting(true);
        navTimeoutRef.current = setTimeout(() => {
          navigate("/home", { replace: true });
        }, 600);
      }, 800);
    } catch (err) {
      console.error("[REGISTER]", err);
      setSubmitting(false);
      releaseLock();
      setError(getFirebaseErrorMessage(err));
    }
  };

  const addressStatusText = dirPlace.hasGeometry
    ? dirPlace.source === "gps"
      ? "✓ Ubicación GPS obtenida"
      : dirPlace.source === "manual_map"
        ? "✓ Ubicación confirmada en el mapa"
        : "✓ Dirección validada"
    : "";

  return (
    <div className={`${styles.screen} ${exiting ? styles.exit : ""}`}>
      <main className={styles.main}>
        <section className={styles.card}>
          <header className={styles.pageHeader}>
            <span>Crear cuenta</span>
            <h1>Registrate</h1>
            <p>Completá tus datos para pedir envíos más rápido.</p>
          </header>

          <form
            className={styles.form}
            onSubmit={handleSubmit}
            aria-busy={submitting}
            aria-live="polite"
          >
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                <span>1</span>
                <h2>Datos personales</h2>
              </div>

              <div className={styles.twoCols}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="nombre">
                    Nombre
                  </label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    className={styles.input}
                    placeholder="Ej: Juan"
                    value={form.nombre}
                    onChange={handleChange}
                    autoComplete="given-name"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="apellido">
                    Apellido
                  </label>
                  <input
                    id="apellido"
                    name="apellido"
                    type="text"
                    className={styles.input}
                    placeholder="Ej: Pérez"
                    value={form.apellido}
                    onChange={handleChange}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="telefono">
                  Teléfono
                </label>
                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  className={styles.input}
                  placeholder="Sin 0 y sin 15"
                  value={form.telefono}
                  onChange={handleChange}
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                />
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                <span>2</span>
                <h2>Dirección principal</h2>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="direccion">
                  Ingresá tu dirección
                </label>

                <div className={styles.addressRow}>
                  <input
                    ref={direccionInputRef}
                    id="direccion"
                    name="direccion"
                    type="text"
                    className={styles.input}
                    placeholder="Calle, número, barrio..."
                    value={form.direccion}
                    onChange={handleChange}
                    autoComplete="street-address"
                    required
                  />

                  <button
                    type="button"
                    className={`${styles.mapBtn} ${locating ? styles.locating : ""}`}
                    onClick={handleGetLocation}
                    disabled={locating}
                  >
                    {locating ? (
                      <span className={styles.locationSpinner} />
                    ) : (
                      <IconCurrentLocation size={15} stroke={2} />
                    )}
                    {locating ? "Obteniendo…" : "Mi ubicación"}
                  </button>
                </div>

                {dirPlace.hasGeometry && (
                  <div className={`${styles.addressStatus} ${styles.addressStatusOk}`}>
                    {addressStatusText}
                  </div>
                )}
              </div>

              <div className={styles.twoCols}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="dpto">
                    Piso / Dpto
                  </label>
                  <input
                    id="dpto"
                    name="dpto"
                    type="text"
                    className={styles.input}
                    placeholder="4B, casa 2"
                    value={form.dpto}
                    onChange={handleChange}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="descripcionDireccion">
                    Manzana / lote
                  </label>
                  <input
                    id="descripcionDireccion"
                    name="descripcionDireccion"
                    type="text"
                    className={styles.input}
                    placeholder="Barrio, Mza 12, Lote 8"
                    value={form.descripcionDireccion}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="referenciaDireccion">
                  Referencia para el cadete
                </label>
                <input
                  id="referenciaDireccion"
                  name="referenciaDireccion"
                  type="text"
                  className={styles.input}
                  placeholder="Portón negro, casa de esquina, tocar timbre"
                  value={form.referenciaDireccion}
                  onChange={handleChange}
                />
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                <span>3</span>
                <h2>Datos de acceso</h2>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={styles.input}
                  placeholder="tucorreo@dominio.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  autoCapitalize="none"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="username">
                  Nombre de usuario
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className={styles.input}
                  placeholder="Lo usarás para iniciar sesión"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                />
              </div>

              <div className={styles.twoCols}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="password">
                    Contraseña
                  </label>

                  <div className={styles.passwordWrap}>
                    <input
                      id="password"
                      name="password"
                      type={showPass ? "text" : "password"}
                      className={styles.input}
                      placeholder="Mínimo 8 caracteres"
                      value={form.password}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                    />

                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowPass((value) => !value)}
                      aria-label={
                        showPass ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                    >
                      {showPass ? eyeOffIcon : eyeIcon}
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="confirm">
                    Repetir contraseña
                  </label>

                  <div className={styles.passwordWrap}>
                    <input
                      id="confirm"
                      name="confirm"
                      type={showConfirm ? "text" : "password"}
                      className={styles.input}
                      placeholder="Repetí la contraseña"
                      value={form.confirm}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                    />

                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowConfirm((value) => !value)}
                      aria-label={
                        showConfirm
                          ? "Ocultar confirmación"
                          : "Mostrar confirmación"
                      }
                    >
                      {showConfirm ? eyeOffIcon : eyeIcon}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {error && <div className={styles.error}>{error}</div>}

            {submitting && (
              <div className={styles.notice} role="status">
                <span className={styles.noticeSpinner} />
                Registrando…
              </div>
            )}

            {success && (
              <div
                className={`${styles.notice} ${styles.successToast}`}
                role="status"
              >
                ¡Cuenta creada! Ingresando…
              </div>
            )}

            <div className={styles.submitRow}>
              <button
                className={`${styles.button} ${submitting ? styles.loading : ""}`}
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <span className={styles.inlineSpinnerWrap}>
                    <span className={styles.spinner} />
                    Registrando…
                  </span>
                ) : (
                  "Crear cuenta"
                )}
              </button>
            </div>

            <div className={styles.loginRow}>
              <span>¿Ya tenés cuenta?</span>
              <Link className={styles.loginLink} to="/login">
                Iniciar sesión
              </Link>
            </div>
          </form>
        </section>
      </main>

      <AdressMapPicker
        open={mapOpen}
        initialCoords={dirPlace.hasGeometry ? dirPlace : null}
        initialAddress={form.direccion}
        onClose={() => setMapOpen(false)}
        onConfirm={handleMapConfirm}
      />
    </div>
  );
}

const eyeIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const eyeOffIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />
    <path
      d="M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-4.42M9.9 4.24A10.6 10.6 0 0122 12s-3.5 6-10 6a12.3 12.3 0 01-5-.98M6.35 6.35A12.2 12.2 0 002 12s3.5 6 10 6"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);