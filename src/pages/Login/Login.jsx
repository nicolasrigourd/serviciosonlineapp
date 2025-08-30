// src/pages/Login/Login.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "./Login.module.css";

import { auth, db } from "../../services/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../state/AuthProvider";

export default function Login() {
  const navigate = useNavigate();
  const { setSessionUser } = useAuth?.() || { setSessionUser: null };

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Animación de entrada tipo “naipes”
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 10);
    return () => clearTimeout(t);
  }, []);

  const isEmail = (s) => /\S+@\S+\.\S+/.test(String(s || "").trim());

  async function loginByUserOrEmail(input, pass) {
    const raw = String(input || "").trim();
    if (!raw) {
      const err = new Error("EMPTY_INPUT");
      err.code = "app/empty-input";
      throw err;
    }

    if (isEmail(raw)) {
      // Email directo
      return await signInWithEmailAndPassword(auth, raw, pass);
    }

    // Username → buscar email público en /usernames/{username}
    const uname = raw.toLowerCase();
    const snap = await getDoc(doc(db, "usernames", uname));
    if (!snap.exists()) {
      const err = new Error("USERNAME_NOT_FOUND");
      err.code = "app/username-not-found";
      throw err;
    }
    const data = snap.data() || {};
    if (!data.email) {
      const err = new Error("EMAIL_NOT_FOUND_FOR_USERNAME");
      err.code = "app/email-not-found";
      throw err;
    }
    return await signInWithEmailAndPassword(auth, data.email, pass);
  }

  // Arma un SessionUser “rico” con compat + addresses
  function buildSessionUser(uid, profile) {
    const p = profile || {};
    const addresses = Array.isArray(p.addresses) ? p.addresses : [];
    const def = addresses.find((a) => a?.isDefault) || addresses[0] || null;

    return {
      uid,
      userNumber: p.userNumber || "",
      username: p.username || "",
      email: p.email || "",
      nombre: p.nombre || "",
      apellido: p.apellido || "",
      telefono: p.telefono || "",
      dpto: p.dpto || "",

      // Compat con Home / pantallas legacy:
      direccion: def?.address || p.direccion || "",
      direccion2: p.direccion2 || "",
      direccion3: p.direccion3 || "",
      direccion4: p.direccion4 || "",
      direccion5: p.direccion5 || "",

      // Estructura escalable:
      addresses,

      createdAt: p.createdAt || null,
      updatedAt: p.updatedAt || null,
      lastSynced: Date.now(),
      version: 1,
    };
  }

  async function fetchProfileAndCache(uid) {
    // Lee el doc del usuario (reglas: solo después de auth)
    const ref = doc(db, "userswebapp", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const err = new Error("USERDOC_NOT_FOUND");
      err.code = "app/userdoc-not-found";
      throw err;
    }
    const prof = snap.data();
    const su = buildSessionUser(uid, prof);
    // Cache local + contexto
    try { localStorage.setItem("SessionUser", JSON.stringify(su)); } catch {}
    if (typeof setSessionUser === "function") setSessionUser(su);
    return su;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setError("");
    const input = (usernameOrEmail || "").trim();
    const pass = password || "";

    if (!input || !pass) {
      setError("Completá usuario/email y contraseña.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Login por email directo o por username→email (colección 'usernames')
      const cred = await loginByUserOrEmail(input, pass);

      // 2) Traer perfil del usuario y armar SessionUser
      await fetchProfileAndCache(cred.user.uid);

      // 3) Navegar a Home
      navigate("/home", { replace: true });
    } catch (e) {
      console.error(e);
      // Mapeo claro de errores
      let msg = "No se pudo iniciar sesión. Intentá nuevamente.";
      switch (e.code) {
        case "app/empty-input":
          msg = "Completá usuario/email y contraseña.";
          break;
        case "app/username-not-found":
          msg = "El usuario no existe.";
          break;
        case "app/email-not-found":
          msg = "No se encontró email para ese usuario.";
          break;
        case "auth/user-not-found":
          msg = "El email no está registrado.";
          break;
        case "auth/invalid-credential":
        case "auth/wrong-password":
          msg = "La contraseña es incorrecta.";
          break;
        case "permission-denied":
          msg = "Permisos insuficientes. Revisá las reglas de Firestore.";
          break;
        default:
          // Si en tus reglas no permitís get en /usernames/{uname} sin auth:
          // e.code podría venir como 'permission-denied' aquí.
          break;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles.screen} ${enter ? styles.enter : ""}`}>
      <header className={styles.header}>
        <img src="/logo.png" alt="Logo" className={styles.logoImg} />
      </header>

      <main className={styles.main}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">Usuario o Email</label>
            <input
              id="username"
              name="username"
              type="text"
              className={styles.input}
              placeholder="tu usuario o email"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              autoComplete="username email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Contraseña</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                name="password"
                type={showPass ? "text" : "password"}
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actionsRow}>
            <button
              className={`${styles.button} ${submitting ? styles.loading : ""}`}
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <span className={styles.inlineSpinnerWrap}>
                  <span className={styles.spinner} /> Iniciando…
                </span>
              ) : (
                "Iniciar sesión"
              )}
            </button>

            <button
              className={styles.linkBtn}
              type="button"
              onClick={() => alert("Luego conectamos el flujo de recuperación 😉")}
            >
              ¿Olvidaste la contraseña? Reestablecer
            </button>
          </div>

          <div className={styles.registerRow}>
            <span>¿No sos usuario?</span>
            <Link className={styles.registerLink} to="/register"> Registrate</Link>
          </div>
        </form>
      </main>

      <footer className={styles.footerSpacer} />
    </div>
  );
}

/* Iconos inline */
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
