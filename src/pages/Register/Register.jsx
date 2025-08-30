/*
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Register.module.css";

// Servicios propios
import { loadGoogleMaps } from "../../lib/googleMapsLoader";


// Firebase
import { auth, db } from "../../services/firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import { doc, setDoc, runTransaction, serverTimestamp } from "firebase/firestore";

export default function Register() {
  const navigate = useNavigate();

  // Lock anti doble-submit + refs para limpiar timeouts
  const submitLockRef = useRef(false);
  const exitTimeoutRef = useRef(null);
  const navTimeoutRef = useRef(null);

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    direccion: "",
    dpto: "", // Piso / Dpto
    email: "",
    username: "",
    password: "",
    confirm: "",
  });

  // Estado de lugar seleccionado por Autocomplete
  const [dirPlace, setDirPlace] = useState({
    formatted: "",
    lat: null,
    lng: null,
    placeId: "",
    hasGeometry: false,
  });

  const direccionInputRef = useRef(null);
  const autoRef = useRef(null);

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [exiting, setExiting] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Inicializa Google Places Autocomplete en el input de dirección
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!apiKey) return;
      const google = await loadGoogleMaps(apiKey);
      if (!isMounted) return;

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
        });
        setError("");
      });
    }

    init().catch(console.error);
    return () => {
      isMounted = false;
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      submitLockRef.current = false;
    };
  }, [apiKey]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");

    if (name === "direccion") {
      // Si edita manualmente, invalida hasta que seleccione del Autocomplete
      setDirPlace((p) => ({ ...p, hasGeometry: false }));
    }
  };

  const genUserNumber = () =>
    String(Math.floor(100000 + Math.random() * 900000));

  const releaseLock = () => {
    submitLockRef.current = false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Candado inmediato
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    // Validaciones mínimas
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
    for (const k of required) {
      if (!String((form[k] ?? "")).trim()) {
        setError("Completá todos los campos.");
        releaseLock();
        return;
      }
    }

    if (!dirPlace.hasGeometry) {
      setError("Seleccioná una dirección válida del listado (autocomplete).");
      releaseLock();
      return;
    }

    const mailRx = /^\S+@\S+\.\S+$/;
    if (!mailRx.test(form.email)) {
      setError("Ingresá un email válido.");
      releaseLock();
      return;
    }

    const digitsOnly = (form.telefono || "").replace(/\D/g, "");
    if (digitsOnly.length < 6) {
      setError("Ingresá un teléfono válido (solo números, sin 0 y sin 15).");
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

    // ====== Firebase: crear Auth, reservar username, guardar perfil ======
    try {
      setSubmitting(true);

      const usernameKey = form.username.trim().toLowerCase();
      const emailNorm = form.email.trim().toLowerCase();

      // (1) Crear cuenta en Auth (queda autenticado)
      const cred = await createUserWithEmailAndPassword(
        auth,
        emailNorm,
        form.password
      );

      // (opcional) Display name en Auth
      await updateProfile(cred.user, {
        displayName: `${form.nombre.trim()} ${form.apellido.trim()}`,
      });

      // (2) Reservar username con transacción (ahora sí hay auth)
      const usernameRef = doc(db, "usernames", usernameKey);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(usernameRef);
          if (snap.exists()) {
            throw new Error("USERNAME_TAKEN");
          }
          tx.set(usernameRef, {
            uid: cred.user.uid,
            reservedAt: serverTimestamp(),
          });
        });
      } catch (txErr) {
        // Si el username estaba tomado, revertimos creando el usuario:
        try {
          await deleteUser(cred.user);
        } catch {}
        if (txErr?.message === "USERNAME_TAKEN") {
          throw txErr; // tratado abajo
        }
        throw txErr;
      }

      // (3) Guardar perfil en Firestore
      const primaryAddress = (dirPlace.formatted || form.direccion).trim();
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

        // Compat con tu Home actual
        direccion: primaryAddress,
        direccion2: "",
        direccion3: "",
        direccion4: "",
        direccion5: "",

        // Piso/Dpto (opcional)
        dpto: (form.dpto || "").trim(),

        // Estructura normalizada con coordenadas
        addresses: [
          {
            id: `DIR-${Date.now()}`,
            label: "Principal",
            address: primaryAddress,
            lat: dirPlace.lat,
            lng: dirPlace.lng,
            piso: (form.dpto || "").trim(),
            isDefault: true,
            placeId: dirPlace.placeId || "",
          },
        ],
      };

      await setDoc(userDocRef, userData);

      // (Opcional) sincronizar store de direcciones local
      try {
        if (typeof upsertDireccion === "function") {
          upsertDireccion({
            id: userData.addresses[0].id,
            label: "Principal",
            address: userData.addresses[0].address,
            lat: userData.addresses[0].lat,
            lng: userData.addresses[0].lng,
            piso: userData.addresses[0].piso,
            isDefault: true,
          });
        }
      } catch {}

      // UX: toast de éxito y navegar a /login con transición
      setSuccess(true);
      setSubmitting(false);

      exitTimeoutRef.current = setTimeout(() => {
        setExiting(true);
        navTimeoutRef.current = setTimeout(() => {
          navigate("/login", { replace: true });
        }, 600);
      }, 1000);
      // Nota: no libero el lock en camino feliz; se libera al desmontar
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      releaseLock();

      if (err?.message === "USERNAME_TAKEN") {
        setError("Ese nombre de usuario ya existe.");
      } else if (String(err).includes("auth/email-already-in-use")) {
        setError("Ese email ya está registrado.");
      } else if (String(err).includes("Missing or insufficient permissions")) {
        setError(
          "Permisos insuficientes en Firestore: revisá las reglas o el orden de escritura."
        );
      } else {
        setError("No se pudo crear el usuario. Intentá nuevamente.");
      }
    }
  };

  return (
    <div className={`${styles.screen} ${exiting ? styles.exit : ""}`}>
      <header className={styles.header}>
        <img src="/logo.png" alt="Logo" className={styles.logoImg} />
      </header>

      <main className={styles.main}>
        <form
          className={styles.form}
          onSubmit={handleSubmit}
          aria-busy={submitting}
          aria-live="polite"
        >
          
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
              required
            />
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
              placeholder="sin 0 y sin 15"
              value={form.telefono}
              onChange={handleChange}
              inputMode="numeric"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="direccion">
              Dirección
            </label>
            <input
              ref={direccionInputRef}
              id="direccion"
              name="direccion"
              type="text"
              className={styles.input}
              placeholder="Calle y número"
              value={form.direccion}
              onChange={handleChange}
              required
            />
          </div>

          
          <div className={styles.field}>
            <label className={styles.label} htmlFor="dpto">
              Piso / Dpto
            </label>
            <input
              id="dpto"
              name="dpto"
              type="text"
              className={styles.input}
              placeholder="4B"
              value={form.dpto}
              onChange={handleChange}
            />
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
              required
            />
          </div>

          
          <hr className={styles.separator} />

         
          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">
              Nombre de usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className={styles.input}
              placeholder="lo usarás para iniciar sesión"
              value={form.username}
              onChange={handleChange}
              required
            />
          </div>

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
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
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
                placeholder="••••••••"
                value={form.confirm}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={
                  showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"
                }
              >
                {showConfirm ? eyeOffIcon : eyeIcon}
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

         
          {submitting && (
            <div className={styles.notice} role="status">
              <span className={styles.spinner} /> Registrando…
            </div>
          )}
          {success && (
            <div className={`${styles.notice} ${styles.successToast}`} role="status">
              ✅ Usuario creado correctamente
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
                  <span className={styles.spinner} /> Registrando…
                </span>
              ) : (
                "Registrar"
              )}
            </button>
          </div>

          <div className={styles.loginRow}>
            <span>¿Ya tenés cuenta?</span>
            <a className={styles.loginLink} href="/login">
              {" "}
              Iniciar sesión
            </a>
          </div>
        </form>
      </main>

      <footer className={styles.footerSpacer} />
    </div>
  );
}


const eyeIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
    viewBox="0 0 24 24" fill="none">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
      stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="3"
      stroke="currentColor" strokeWidth="2" />
  </svg>
);

const eyeOffIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
    viewBox="0 0 24 24" fill="none">
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2"/>
    <path d="M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-4.42M9.9 4.24A10.6 10.6 0 0122 12s-3.5 6-10 6a12.3 12.3 0 01-5-.98M6.35 6.35A12.2 12.2 0 002 12s3.5 6 10 6"
      stroke="currentColor" strokeWidth="2" />
  </svg>
);
*/
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Register.module.css";

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

export default function Register() {
  const navigate = useNavigate();

  // Lock anti doble-submit + refs para limpiar timeouts
  const submitLockRef = useRef(false);
  const exitTimeoutRef = useRef(null);
  const navTimeoutRef = useRef(null);

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    direccion: "",
    dpto: "", // Piso / Dpto
    email: "",
    username: "",
    password: "",
    confirm: "",
  });

  // Estado de lugar seleccionado por Autocomplete
  const [dirPlace, setDirPlace] = useState({
    formatted: "",
    lat: null,
    lng: null,
    placeId: "",
    hasGeometry: false,
  });

  const direccionInputRef = useRef(null);
  const autoRef = useRef(null);

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [exiting, setExiting] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Inicializa Google Places Autocomplete en el input de dirección
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!apiKey) return;
      const google = await loadGoogleMaps(apiKey);
      if (!isMounted) return;

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
        });
        setError("");
      });
    }

    init().catch(console.error);
    return () => {
      isMounted = false;
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      submitLockRef.current = false;
    };
  }, [apiKey]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");

    if (name === "direccion") {
      // Si edita manualmente, invalida hasta que seleccione del Autocomplete
      setDirPlace((p) => ({ ...p, hasGeometry: false }));
    }
  };

  const genUserNumber = () =>
    String(Math.floor(100000 + Math.random() * 900000));

  const releaseLock = () => {
    submitLockRef.current = false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Candado inmediato
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    // Validaciones mínimas
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
    for (const k of required) {
      if (!String((form[k] ?? "")).trim()) {
        setError("Completá todos los campos.");
        releaseLock();
        return;
      }
    }

    if (!dirPlace.hasGeometry) {
      setError("Seleccioná una dirección válida del listado (autocomplete).");
      releaseLock();
      return;
    }

    const mailRx = /^\S+@\S+\.\S+$/;
    if (!mailRx.test(form.email)) {
      setError("Ingresá un email válido.");
      releaseLock();
      return;
    }

    const digitsOnly = (form.telefono || "").replace(/\D/g, "");
    if (digitsOnly.length < 6) {
      setError("Ingresá un teléfono válido (solo números, sin 0 y sin 15).");
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

    // ====== Firebase: validar username, crear Auth, reservar username, guardar perfil ======
    try {
      setSubmitting(true);
      setError("");

      const usernameKey = form.username.trim().toLowerCase();
      const emailNorm = form.email.trim().toLowerCase();

      // (0) Pre-chequeo rápido de unicidad (UX)
      const preRef = doc(db, "usernames", usernameKey);
      const preSnap = await getDoc(preRef);
      if (preSnap.exists()) {
        setSubmitting(false);
        releaseLock();
        setError("Ese nombre de usuario ya existe.");
        return;
      }

      // (1) Crear cuenta en Auth (queda autenticado)
      const cred = await createUserWithEmailAndPassword(
        auth,
        emailNorm,
        form.password
      );

      // (opcional) Display name en Auth
      await updateProfile(cred.user, {
        displayName: `${form.nombre.trim()} ${form.apellido.trim()}`,
      });

      // (2) Reservar username con TRANSACCIÓN (evita colisiones)
      const usernameRef = doc(db, "usernames", usernameKey);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(usernameRef);
          if (snap.exists()) {
            throw new Error("USERNAME_TAKEN");
          }
          tx.set(usernameRef, {
            uid: cred.user.uid,
            email: emailNorm,            // 👈 NECESARIO para login por username
            reservedAt: serverTimestamp(),
          });
        });
      } catch (txErr) {
        // Si el username estaba tomado, revertimos el usuario creado en Auth
        try { await deleteUser(cred.user); } catch {}
        if (txErr?.message === "USERNAME_TAKEN") {
          throw txErr; // tratado abajo
        }
        throw txErr;
      }

      // (3) Guardar perfil en Firestore
      const primaryAddress = (dirPlace.formatted || form.direccion).trim();
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

        // Compat con Home actual
        direccion: primaryAddress,
        direccion2: "",
        direccion3: "",
        direccion4: "",
        direccion5: "",

        // Piso/Dpto (opcional)
        dpto: (form.dpto || "").trim(),

        // Estructura normalizada con coordenadas
        addresses: [
          {
            id: `DIR-${Date.now()}`,
            label: "Principal",
            alias: "Principal",
            address: primaryAddress,
            lat: dirPlace.lat,
            lng: dirPlace.lng,
            piso: (form.dpto || "").trim(),
            notas: "",
            isDefault: true,
            placeId: dirPlace.placeId || "",
          },
        ],
      };

      await setDoc(userDocRef, userData, { merge: true });

      // UX: toast de éxito y navegar a /login con transición
      setSuccess(true);
      setSubmitting(false);

      exitTimeoutRef.current = setTimeout(() => {
        setExiting(true);
        navTimeoutRef.current = setTimeout(() => {
          navigate("/login", { replace: true });
        }, 600);
      }, 1000);
      // Nota: no libero el lock en camino feliz; se libera al desmontar
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      releaseLock();

      if (err?.message === "USERNAME_TAKEN") {
        setError("Ese nombre de usuario ya existe.");
      } else if (String(err).includes("auth/email-already-in-use")) {
        setError("Ese email ya está registrado.");
      } else if (String(err).includes("Missing or insufficient permissions")) {
        setError("Permisos insuficientes en Firestore: revisá las reglas o el orden de escritura.");
      } else {
        setError("No se pudo crear el usuario. Intentá nuevamente.");
      }
    }
  };

  return (
    <div className={`${styles.screen} ${exiting ? styles.exit : ""}`}>
      <header className={styles.header}>
        <img src="/logo.png" alt="Logo" className={styles.logoImg} />
      </header>

      <main className={styles.main}>
        <form
          className={styles.form}
          onSubmit={handleSubmit}
          aria-busy={submitting}
          aria-live="polite"
        >
          {/* Datos personales */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="nombre">Nombre</label>
            <input
              id="nombre" name="nombre" type="text"
              className={styles.input} placeholder="Ej: Juan"
              value={form.nombre} onChange={handleChange} required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="apellido">Apellido</label>
            <input
              id="apellido" name="apellido" type="text"
              className={styles.input} placeholder="Ej: Pérez"
              value={form.apellido} onChange={handleChange} required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="telefono">Teléfono</label>
            <input
              id="telefono" name="telefono" type="tel"
              className={styles.input} placeholder="sin 0 y sin 15"
              value={form.telefono} onChange={handleChange}
              inputMode="numeric" required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="direccion">Dirección</label>
            <input
              ref={direccionInputRef}
              id="direccion" name="direccion" type="text"
              className={styles.input} placeholder="Calle y número"
              value={form.direccion} onChange={handleChange} required
            />
          </div>

          {/* Piso / Dpto (opcional) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="dpto">Piso / Dpto</label>
            <input
              id="dpto" name="dpto" type="text"
              className={styles.input} placeholder="4B"
              value={form.dpto} onChange={handleChange}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email" name="email" type="email"
              className={styles.input} placeholder="tucorreo@dominio.com"
              value={form.email} onChange={handleChange}
              autoComplete="email" required
            />
          </div>

          {/* Separador */}
          <hr className={styles.separator} />

          {/* Cuenta */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">Nombre de usuario</label>
            <input
              id="username" name="username" type="text"
              className={styles.input}
              placeholder="lo usarás para iniciar sesión"
              value={form.username} onChange={handleChange} required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Contraseña</label>
            <div className={styles.passwordWrap}>
              <input
                id="password" name="password"
                type={showPass ? "text" : "password"}
                className={styles.input} placeholder="••••••••"
                value={form.password} onChange={handleChange}
                required autoComplete="new-password"
              />
              <button
                type="button" className={styles.eyeBtn}
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? eyeOffIcon : eyeIcon}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">Repetir contraseña</label>
            <div className={styles.passwordWrap}>
              <input
                id="confirm" name="confirm"
                type={showConfirm ? "text" : "password"}
                className={styles.input} placeholder="••••••••"
                value={form.confirm} onChange={handleChange}
                required autoComplete="new-password"
              />
              <button
                type="button" className={styles.eyeBtn}
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
              >
                {showConfirm ? eyeOffIcon : eyeIcon}
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {/* Estado de proceso y éxito */}
          {submitting && (
            <div className={styles.notice} role="status">
              <span className={styles.spinner} /> Registrando…
            </div>
          )}
          {success && (
            <div className={`${styles.notice} ${styles.successToast}`} role="status">
              ✅ Usuario creado correctamente
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
                  <span className={styles.spinner} /> Registrando…
                </span>
              ) : (
                "Registrar"
              )}
            </button>
          </div>

          <div className={styles.loginRow}>
            <span>¿Ya tenés cuenta?</span>
            <a className={styles.loginLink} href="/login"> Iniciar sesión</a>
          </div>
        </form>
      </main>

      <footer className={styles.footerSpacer} />
    </div>
  );
}

/* Iconos inline (tus mismos) */
const eyeIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
    viewBox="0 0 24 24" fill="none">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
      stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="3"
      stroke="currentColor" strokeWidth="2" />
  </svg>
);

const eyeOffIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
    viewBox="0 0 24 24" fill="none">
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2"/>
    <path d="M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-4.42M9.9 4.24A10.6 10.6 0 0122 12s-3.5 6-10 6a12.3 12.3 0 01-5-.98M6.35 6.35A12.2 12.2 0 002 12s3.5 6 10 6"
      stroke="currentColor" strokeWidth="2" />
  </svg>
);
