import React, { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav/BottomNav";
import styles from "./Profile.module.css";
import { useNavigate } from "react-router-dom";

// Firebase + contexto
import { auth, db } from "../../services/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useAuth } from "../../state/AuthProvider";

function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem("SessionUser") || "null");
  } catch {
    return null;
  }
}

function getFirebasePasswordError(error) {
  if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
    return "La contraseña actual no es correcta.";
  }

  if (error?.code === "auth/weak-password") {
    return "La nueva contraseña es demasiado débil.";
  }

  if (error?.code === "auth/too-many-requests") {
    return "Demasiados intentos. Probá más tarde.";
  }

  if (error?.code === "auth/requires-recent-login") {
    return "Por seguridad, volvé a iniciar sesión e intentá de nuevo.";
  }

  if (error?.code === "auth/network-request-failed") {
    return "No pudimos conectar. Revisá tu conexión a internet.";
  }

  return "No se pudo actualizar la contraseña.";
}

export default function Profile() {
  const navigate = useNavigate();
  const authContext = useAuth?.() || {};
  const { user: ctxUser, setSessionUser } = authContext;

  const cached = getCachedUser();
  const baseUser = ctxUser || cached;

  const [user, setUser] = useState(baseUser || null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    username: "",
    email: "",
    telefono: "",
  });

  const [pwForm, setPwForm] = useState({
    current: "",
    next: "",
    repeat: "",
    show: false,
  });

  useEffect(() => {
    const u = ctxUser || getCachedUser() || null;

    setUser(u);

    setForm({
      nombre: u?.nombre || "",
      apellido: u?.apellido || "",
      username: u?.username || "",
      email: u?.email || "",
      telefono: u?.telefono || "",
    });
  }, [ctxUser]);

  const avatarLetter =
    form?.nombre?.[0]?.toUpperCase() ||
    form?.username?.[0]?.toUpperCase() ||
    "U";

  const fullName = useMemo(() => {
    const joined = [form.nombre, form.apellido].filter(Boolean).join(" ").trim();
    return joined || "Sin nombre";
  }, [form.nombre, form.apellido]);

  const direccionActual = useMemo(() => {
    const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
    const def = addresses.find((addr) => addr?.isDefault) || addresses[0] || null;

    if (def?.address) {
      return {
        address: def.address,
        detail: [def.piso, def.descripcion, def.referencia]
          .filter(Boolean)
          .join(" · "),
      };
    }

    return {
      address: user?.direccion || "Sin dirección actual",
      detail: user?.direccionDescripcion || user?.direccionReferencia || "",
    };
  }, [user]);

  const onChange = (key, value) => {
    setForm((state) => ({ ...state, [key]: value }));
    setNotice("");
    setError("");
  };

  const rebuildSessionUser = (prev, profile) => {
    const p = profile || {};
    const addresses = Array.isArray(p.addresses) ? p.addresses : [];
    const def = addresses.find((addr) => addr?.isDefault) || addresses[0] || null;

    return {
      ...(prev || {}),
      uid: prev?.uid || p.uid,
      userNumber: p.userNumber || prev?.userNumber || "",
      username: p.username || prev?.username || "",
      email: p.email || prev?.email || "",
      nombre: p.nombre || prev?.nombre || "",
      apellido: p.apellido || prev?.apellido || "",
      telefono: p.telefono || prev?.telefono || "",
      dpto: p.dpto || prev?.dpto || "",

      direccion: def?.address || p.direccion || prev?.direccion || "",
      direccionDescripcion:
        def?.descripcion || p.direccionDescripcion || prev?.direccionDescripcion || "",
      direccionReferencia:
        def?.referencia || p.direccionReferencia || prev?.direccionReferencia || "",
      direccion2: p.direccion2 || prev?.direccion2 || "",
      direccion3: p.direccion3 || prev?.direccion3 || "",
      direccion4: p.direccion4 || prev?.direccion4 || "",
      direccion5: p.direccion5 || prev?.direccion5 || "",

      addresses,
      createdAt: p.createdAt || prev?.createdAt || null,
      updatedAt: p.updatedAt || Date.now(),
      lastSynced: Date.now(),
      version: prev?.version || 1,
    };
  };

  const saveProfile = async () => {
    if (!user?.uid) {
      setError("No hay sesión activa.");
      return;
    }

    const telDigits = String(form.telefono || "").replace(/\D/g, "");

    if (telDigits && telDigits.length < 6) {
      setError("Ingresá un teléfono válido, solo números, sin 0 y sin 15.");
      return;
    }

    setLoadingProfile(true);
    setNotice("");
    setError("");

    try {
      const ref = doc(db, "userswebapp", user.uid);

      await setDoc(
        ref,
        {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          telefono: telDigits,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      try {
        await updateProfile(auth.currentUser, {
          displayName:
            [form.nombre.trim(), form.apellido.trim()].filter(Boolean).join(" ") ||
            auth.currentUser?.displayName ||
            "",
        });
      } catch {}

      const snap = await getDoc(ref);
      const refreshed = rebuildSessionUser(user, snap.exists() ? snap.data() : {});

      setUser(refreshed);

      try {
        localStorage.setItem("SessionUser", JSON.stringify(refreshed));
      } catch {}

      if (typeof setSessionUser === "function") {
        setSessionUser(refreshed);
      }

      setNotice("Perfil actualizado correctamente.");
    } catch (err) {
      console.error("[PROFILE] Error guardando perfil:", err);
      setError("No se pudo guardar. Reintentá.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const changePassword = async () => {
    const { current, next, repeat } = pwForm;

    setNotice("");
    setError("");

    if (!current) {
      setError("Ingresá tu contraseña actual.");
      return;
    }

    if (!next || !repeat) {
      setError("Completá los campos de nueva contraseña.");
      return;
    }

    if (next.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (next !== repeat) {
      setError("La repetición no coincide.");
      return;
    }

    if (!auth.currentUser?.email) {
      setError("No se puede cambiar la contraseña sin email en la sesión.");
      return;
    }

    setLoadingPassword(true);

    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, next);

      setPwForm({
        current: "",
        next: "",
        repeat: "",
        show: false,
      });

      setNotice("Contraseña actualizada correctamente.");
    } catch (err) {
      console.error("[PROFILE] Error actualizando contraseña:", err);
      setError(getFirebasePasswordError(err));
    } finally {
      setLoadingPassword(false);
    }
  };

  const sendReset = async () => {
    setNotice("");
    setError("");

    if (!form.email) {
      setError("No hay email cargado.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, form.email);
      setNotice("Te enviamos un email para restablecer la contraseña.");
    } catch (err) {
      console.error("[PROFILE] Error enviando reset:", err);
      setError("No se pudo enviar el correo de restablecimiento.");
    }
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Cuenta</span>
          <h1 className={styles.title}>Mi perfil</h1>
          <p className={styles.subtitle}>Administrá tus datos personales y de acceso.</p>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.heroCard}>
          <div className={styles.avatar} aria-hidden="true">
            {avatarLetter}
          </div>

          <div className={styles.identity}>
            <h2>{fullName}</h2>
            <p>@{form.username || "usuario"}</p>
            {user?.userNumber && <span>Cliente #{user.userNumber}</span>}
          </div>
        </section>

        {(notice || error) && (
          <div className={`${styles.message} ${error ? styles.messageError : styles.messageOk}`}>
            {error || notice}
          </div>
        )}

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>{userIcon}</div>
            <div>
              <h2 className={styles.cardTitle}>Datos personales</h2>
              <p className={styles.cardText}>Actualizá tu nombre y teléfono.</p>
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="nombre">
                Nombre
              </label>
              <input
                id="nombre"
                className={styles.input}
                value={form.nombre}
                onChange={(event) => onChange("nombre", event.target.value)}
                placeholder="Ej: Nicolás"
                autoComplete="given-name"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="apellido">
                Apellido
              </label>
              <input
                id="apellido"
                className={styles.input}
                value={form.apellido}
                onChange={(event) => onChange("apellido", event.target.value)}
                placeholder="Ej: Pérez"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="username">
                Usuario
              </label>
              <input
                id="username"
                className={`${styles.input} ${styles.inputReadOnly}`}
                value={form.username}
                readOnly
                placeholder="usuario"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="telefono">
                Teléfono
              </label>
              <input
                id="telefono"
                className={styles.input}
                value={form.telefono}
                onChange={(event) => onChange("telefono", event.target.value)}
                placeholder="Sin 0 y sin 15"
                inputMode="numeric"
                autoComplete="tel"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`${styles.input} ${styles.inputReadOnly}`}
              value={form.email}
              readOnly
              placeholder="usuario@mail.com"
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={saveProfile}
              disabled={loadingProfile}
            >
              {loadingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>{pinIcon}</div>
            <div>
              <h2 className={styles.cardTitle}>Dirección actual</h2>
              <p className={styles.cardText}>Esta dirección se usa como origen principal.</p>
            </div>
          </div>

          <button
            type="button"
            className={styles.addrBox}
            onClick={() => navigate("/direcciones")}
          >
            <span className={styles.addrPin} aria-hidden="true">
              {pinIcon}
            </span>

            <span className={styles.addrText}>
              <strong>{direccionActual.address}</strong>
              {direccionActual.detail && <em>{direccionActual.detail}</em>}
            </span>

            <span className={styles.addrChevron}>{chevIcon}</span>
          </button>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>{lockIcon}</div>
            <div>
              <h2 className={styles.cardTitle}>Seguridad</h2>
              <p className={styles.cardText}>Cambiá tu contraseña o solicitá un reinicio por email.</p>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="curr">
              Contraseña actual
            </label>
            <input
              id="curr"
              className={styles.input}
              type={pwForm.show ? "text" : "password"}
              value={pwForm.current}
              onChange={(event) =>
                setPwForm((state) => ({ ...state, current: event.target.value }))
              }
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="next">
                Nueva contraseña
              </label>
              <input
                id="next"
                className={styles.input}
                type={pwForm.show ? "text" : "password"}
                value={pwForm.next}
                onChange={(event) =>
                  setPwForm((state) => ({ ...state, next: event.target.value }))
                }
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="repeat">
                Repetir nueva
              </label>
              <input
                id="repeat"
                className={styles.input}
                type={pwForm.show ? "text" : "password"}
                value={pwForm.repeat}
                onChange={(event) =>
                  setPwForm((state) => ({ ...state, repeat: event.target.value }))
                }
                placeholder="Repetí la nueva"
                autoComplete="new-password"
              />
            </div>
          </div>

          <label className={styles.chk}>
            <input
              type="checkbox"
              checked={pwForm.show}
              onChange={() =>
                setPwForm((state) => ({ ...state, show: !state.show }))
              }
            />
            <span>Mostrar contraseñas</span>
          </label>

          <div className={styles.securityActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={changePassword}
              disabled={loadingPassword}
            >
              {loadingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>

            <button type="button" className={styles.linkBtn} onClick={sendReset}>
              Restablecer por email
            </button>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

const userIcon = (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const pinIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const lockIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const chevIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);