import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";

import { auth, db } from "../../services/firebase";
import { useAuth } from "../../state/AuthProvider";
import styles from "./Login.module.css";
import logoLogin from "../../assets/logocadeteriaoriginal.png";

const isEmail = (value) => /\S+@\S+\.\S+/.test(String(value || "").trim());

async function resolveEmail(usernameOrEmail) {
  const raw = String(usernameOrEmail || "").trim();
  if (isEmail(raw)) return raw.toLowerCase();

  const snap = await getDoc(doc(db, "usernames", raw.toLowerCase()));
  if (!snap.exists()) throw new Error("USERNAME_NOT_FOUND");

  const { uid } = snap.data() || {};
  if (!uid) throw new Error("USERNAME_WITHOUT_UID");

  const userSnap = await getDoc(doc(db, "userswebapp", uid));
  if (!userSnap.exists()) throw new Error("USERDOC_NOT_FOUND");

  const email = userSnap.data()?.email;
  if (!email) throw new Error("USERDOC_WITHOUT_EMAIL");

  return email.toLowerCase();
}

function getErrorMessage(code) {
  const map = {
    "app/empty-input":          "Completá usuario/email y contraseña.",
    "USERNAME_NOT_FOUND":       "El usuario ingresado no existe.",
    "USERNAME_WITHOUT_UID":     "No pudimos encontrar tu cuenta.",
    "USERDOC_NOT_FOUND":        "Tu cuenta existe pero falta el perfil.",
    "USERDOC_WITHOUT_EMAIL":    "No encontramos un email para ese usuario.",
    "EMAIL_NOT_FOUND":          "El email no está registrado.",
    "auth/user-not-found":      "El email ingresado no está registrado.",
    "auth/invalid-email":       "El email no tiene un formato válido.",
    "auth/invalid-credential":  "La contraseña es incorrecta o los datos no coinciden.",
    "auth/wrong-password":      "La contraseña es incorrecta o los datos no coinciden.",
    "auth/too-many-requests":   "Demasiados intentos. Esperá unos minutos.",
    "auth/network-request-failed": "Sin conexión. Revisá tu internet.",
  };
  return map[code] || "No se pudo iniciar sesión. Intentá nuevamente.";
}

export default function Login() {
  const navigate    = useNavigate();
  const { login }   = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword]               = useState("");
  const [showPass, setShowPass]               = useState(false);
  const [error, setError]                     = useState("");
  const [submitting, setSubmitting]           = useState(false);
  const [enter, setEnter]                     = useState(false);

  const [resetSent, setResetSent]     = useState(false);
  const [resetError, setResetError]   = useState("");
  const [resetting, setResetting]     = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 10);
    return () => clearTimeout(t);
  }, []);

  const canSubmit = useMemo(
    () => usernameOrEmail.trim().length > 0 && password.length > 0 && !submitting,
    [usernameOrEmail, password, submitting],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const input = String(usernameOrEmail || "").trim();
    const pass  = password || "";

    if (!input || !pass) {
      setError("Completá usuario/email y contraseña.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await login(input, pass);
      navigate("/home", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err?.message || err?.code));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecuperarPassword = async () => {
    const input = String(usernameOrEmail || "").trim();

    if (!input) {
      setResetError("Ingresá tu usuario o email primero.");
      return;
    }

    setResetError("");
    setResetSent(false);
    setResetting(true);

    try {
      const email = await resolveEmail(input);
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setResetError(getErrorMessage(err?.message || err?.code));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={`${styles.screen} ${enter ? styles.enter : ""}`}>
      <header className={styles.logoBox}>
        <img src={logoLogin} alt="El Cadete Express" className={styles.logoImg} />
      </header>

      <section className={styles.card} aria-label="Inicio de sesión">
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="username">
                Ingresá tu usuario o email
              </label>
              <input
                id="username"
                name="username"
                type="text"
                className={styles.input}
                placeholder="tu usuario o email"
                value={usernameOrEmail}
                onChange={(e) => { setUsernameOrEmail(e.target.value); setError(""); setResetError(""); setResetSent(false); }}
                autoComplete="username email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                inputMode="email"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Ingresá tu contraseña
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
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
                onClick={handleRecuperarPassword}
                disabled={resetting}
              >
                {resetting ? "Enviando…" : "¿Olvidaste tu contraseña?"}
              </button>
            </div>

            {resetSent && (
              <p className={styles.resetSuccess} role="status">
                Te enviamos un email para restablecer tu contraseña.
              </p>
            )}

            {resetError && (
              <p className={styles.resetError} role="alert">
                {resetError}
              </p>
            )}

            <div className={styles.registerRow}>
              <span>¿No sos usuario?</span>
              <Link className={styles.registerLink} to="/register">
                Registrate
              </Link>
            </div>
          </form>
      </section>
    </div>
  );
}

const eyeIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const eyeOffIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />
    <path d="M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-4.42M9.9 4.24A10.6 10.6 0 0122 12s-3.5 6-10 6a12.3 12.3 0 01-5-.98M6.35 6.35A12.2 12.2 0 002 12s3.5 6 10 6" stroke="currentColor" strokeWidth="2" />
  </svg>
);
