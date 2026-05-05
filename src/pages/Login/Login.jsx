// src/pages/Login/Login.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "./Login.module.css";

import { auth, db } from "../../services/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../state/AuthProvider";

import logoLogin from "../../assets/logologin.png";

export default function Login() {
  const navigate = useNavigate();
  const { setSessionUser } = useAuth?.() || { setSessionUser: null };

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 10);
    return () => clearTimeout(t);
  }, []);

  const canSubmit = useMemo(() => {
    return usernameOrEmail.trim().length > 0 && password.length > 0 && !submitting;
  }, [usernameOrEmail, password, submitting]);

  const isEmail = (value) => /\S+@\S+\.\S+/.test(String(value || "").trim());

  async function loginByUserOrEmail(input, pass) {
    const raw = String(input || "").trim();

    if (!raw || !pass) {
      const err = new Error("EMPTY_INPUT");
      err.code = "app/empty-input";
      throw err;
    }

    if (isEmail(raw)) {
      return await signInWithEmailAndPassword(auth, raw, pass);
    }

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

      direccion: def?.address || p.direccion || "",
      direccion2: p.direccion2 || "",
      direccion3: p.direccion3 || "",
      direccion4: p.direccion4 || "",
      direccion5: p.direccion5 || "",

      addresses,

      createdAt: p.createdAt || null,
      updatedAt: p.updatedAt || null,
      lastSynced: Date.now(),
      version: 1,
    };
  }

  async function fetchProfileAndCache(uid) {
    const ref = doc(db, "userswebapp", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const err = new Error("USERDOC_NOT_FOUND");
      err.code = "app/userdoc-not-found";
      throw err;
    }

    const profile = snap.data();
    const sessionUser = buildSessionUser(uid, profile);

    try {
      localStorage.setItem("SessionUser", JSON.stringify(sessionUser));
    } catch (storageError) {
      console.warn("[LOGIN] No se pudo guardar SessionUser:", storageError);
    }

    if (typeof setSessionUser === "function") {
      setSessionUser(sessionUser);
    }

    return sessionUser;
  }

  function getErrorMessage(errorCode) {
    switch (errorCode) {
      case "app/empty-input":
        return "Completá usuario/email y contraseña.";

      case "app/username-not-found":
        return "El usuario ingresado no existe.";

      case "app/email-not-found":
        return "No encontramos un email asociado a ese usuario.";

      case "app/userdoc-not-found":
        return "Tu cuenta existe, pero falta completar tu perfil.";

      case "auth/user-not-found":
        return "El email ingresado no está registrado.";

      case "auth/invalid-email":
        return "El email ingresado no tiene un formato válido.";

      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "La contraseña es incorrecta o los datos no coinciden.";

      case "auth/too-many-requests":
        return "Demasiados intentos. Esperá unos minutos y volvé a intentar.";

      case "auth/network-request-failed":
        return "No pudimos conectar. Revisá tu conexión a internet.";

      case "permission-denied":
        return "No tenés permisos para acceder.";

      default:
        return "No se pudo iniciar sesión. Intentá nuevamente.";
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError("");

    const input = String(usernameOrEmail || "").trim();
    const pass = password || "";

    if (!input || !pass) {
      setError("Completá usuario/email y contraseña.");
      return;
    }

    setSubmitting(true);

    try {
      const cred = await loginByUserOrEmail(input, pass);
      await fetchProfileAndCache(cred.user.uid);
      navigate("/home", { replace: true });
    } catch (err) {
      console.error("[LOGIN]", err);
      setError(getErrorMessage(err?.code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles.screen} ${enter ? styles.enter : ""}`}>
      <main className={styles.shell}>
        <header className={styles.logoBox}>
          <img
            src={logoLogin}
            alt="El Cadete Express"
            className={styles.logoImg}
          />
        </header>

        <section className={styles.card} aria-label="Inicio de sesión">
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formHeader}>
              <h1>Iniciar sesión</h1>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="username">
                Usuario o email
              </label>

              <input
                id="username"
                name="username"
                type="text"
                className={styles.input}
                placeholder="tu usuario o email"
                value={usernameOrEmail}
                onChange={(event) => {
                  setUsernameOrEmail(event.target.value);
                  if (error) setError("");
                }}
                autoComplete="username email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                inputMode="email"
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
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="current-password"
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

            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <div className={styles.actionsRow}>
              <button
                className={`${styles.button} ${submitting ? styles.loading : ""}`}
                type="submit"
                disabled={!canSubmit}
              >
                {submitting ? (
                  <span className={styles.inlineSpinnerWrap}>
                    <span className={styles.spinner} />
                    Iniciando…
                  </span>
                ) : (
                  "Iniciar sesión"
                )}
              </button>

              <button
                className={styles.linkBtn}
                type="button"
                onClick={() =>
                  alert("Luego conectamos el flujo de recuperación de contraseña.")
                }
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div className={styles.registerRow}>
              <span>¿No sos usuario?</span>
              <Link className={styles.registerLink} to="/register">
                Registrate
              </Link>
            </div>
          </form>
        </section>
      </main>
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