/*
import React, { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav/BottomNav";
import styles from "./Profile.module.css";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    username: "",
    email: "",
    telefono: "",
  });

  // Password form (demo)
  const [pwForm, setPwForm] = useState({
    current: "",
    next: "",
    repeat: "",
    show: false,
  });

  // Cargar SessionUser
  useEffect(() => {
    try {
      const raw = localStorage.getItem("SessionUser");
      const su = raw ? JSON.parse(raw) : null;
      setUser(su);
      setForm({
        nombre: su?.nombre || "",
        username: su?.username || "",
        email: su?.email || "",
        telefono: su?.telefono || "",
      });
    } catch (e) {
      console.warn("No se pudo leer SessionUser", e);
    }
  }, []);

  const direccionActual = useMemo(
    () => user?.direccion || "Sin dirección actual",
    [user]
  );

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const saveProfile = () => {
    try {
      const raw = localStorage.getItem("SessionUser");
      const su = raw ? JSON.parse(raw) : {};
      su.nombre = form.nombre.trim();
      su.username = form.username.trim();
      su.email = form.email.trim();
      su.telefono = form.telefono.trim();
      localStorage.setItem("SessionUser", JSON.stringify(su));
      setUser(su);
      alert("Perfil actualizado.");
    } catch (e) {
      alert("No se pudo guardar. Reintentá.");
    }
  };

  const toggleShow = () => setPwForm((s) => ({ ...s, show: !s.show }));

  const changePassword = () => {
    const { current, next, repeat } = pwForm;
    if (!next || !repeat) return alert("Completá los campos de nueva contraseña.");
    if (next.length < 6) return alert("La nueva contraseña debe tener al menos 6 caracteres.");
    if (next !== repeat) return alert("La repetición no coincide.");
    try {
      const raw = localStorage.getItem("SessionUser");
      const su = raw ? JSON.parse(raw) : {};
      // Validación básica demo: comparar con su.password si existe
      if (su.password && current !== su.password) {
        return alert("La contraseña actual no es correcta.");
      }
      su.password = next;
      localStorage.setItem("SessionUser", JSON.stringify(su));
      setPwForm({ current: "", next: "", repeat: "", show: false });
      alert("Contraseña actualizada.");
    } catch {
      alert("No se pudo actualizar la contraseña.");
    }
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mi perfil</h1>
        <p className={styles.subtitle}>Tus datos de cuenta</p>
      </header>

      <main className={styles.main}>
      
        <section className={styles.card}>
          <div className={styles.rowA}>
            <div className={styles.avatar} aria-hidden="true">
              {form?.nombre?.[0]?.toUpperCase() || form?.username?.[0]?.toUpperCase() || "U"}
            </div>
            <div className={styles.idInfo}>
              <div className={styles.nameStrong}>{form.nombre || "Sin nombre"}</div>
              <div className={styles.userMeta}>@{form.username || "usuario"}</div>
            </div>
          </div>
        </section>

    
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Datos personales</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="nombre">Nombre y apellido</label>
            <input
              id="nombre"
              className={styles.input}
              value={form.nombre}
              onChange={(e) => onChange("nombre", e.target.value)}
              placeholder="Ej: Nicolás Pérez"
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="username">Usuario</label>
              <input
                id="username"
                className={styles.input}
                value={form.username}
                onChange={(e) => onChange("username", e.target.value)}
                placeholder="nick"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                className={styles.input}
                value={form.telefono}
                onChange={(e) => onChange("telefono", e.target.value)}
                placeholder="+54 9 ..."
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="usuario@mail.com"
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.saveBtn} onClick={saveProfile}>
              Guardar cambios
            </button>
          </div>
        </section>

     
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Dirección actual</h2>
          <div className={styles.addrBox}>
            <span className={styles.addrPin} aria-hidden="true">📍</span>
            <div className={styles.addrText}>{direccionActual}</div>
          </div>
          <div className={styles.actionsRight}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => navigate("/addresses")}
            >
              Gestionar direcciones
            </button>
          </div>
        </section>

        
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Cambiar contraseña</h2>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="curr">Contraseña actual</label>
            <input
              id="curr"
              className={styles.input}
              type={pwForm.show ? "text" : "password"}
              value={pwForm.current}
              onChange={(e) => setPwForm((s) => ({ ...s, current: e.target.value }))}
              placeholder="••••••••"
            />
          </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="next">Nueva contraseña</label>
                <input
                  id="next"
                  className={styles.input}
                  type={pwForm.show ? "text" : "password"}
                  value={pwForm.next}
                  onChange={(e) => setPwForm((s) => ({ ...s, next: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="repeat">Repetir nueva</label>
                <input
                  id="repeat"
                  className={styles.input}
                  type={pwForm.show ? "text" : "password"}
                  value={pwForm.repeat}
                  onChange={(e) => setPwForm((s) => ({ ...s, repeat: e.target.value }))}
                  placeholder="Repetí la nueva"
                />
              </div>
            </div>

          <label className={styles.chk}>
            <input type="checkbox" checked={pwForm.show} onChange={toggleShow} />
            <span>Mostrar contraseñas</span>
          </label>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={changePassword}>
              Actualizar contraseña
            </button>
          </div>
          <p className={styles.note}>
            * Solo a modo demo: se guarda localmente en <code>SessionUser.password</code>.
          </p>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
*/
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

export default function Profile() {
  const navigate = useNavigate();
  const { user: ctxUser, setSessionUser } = useAuth?.() || { user: null, setSessionUser: null };

  const cached = (() => {
    try { return JSON.parse(localStorage.getItem("SessionUser") || "null"); } catch { return null; }
  })();
  const baseUser = ctxUser || cached;

  const [user, setUser] = useState(baseUser || null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    username: "",
    email: "",
    telefono: "",
  });

  // Password form
  const [pwForm, setPwForm] = useState({
    current: "",
    next: "",
    repeat: "",
    show: false,
  });

  // Cargar datos iniciales
  useEffect(() => {
    const u = ctxUser || cached || null;
    setUser(u);
    setForm({
      nombre: u?.nombre || "",
      username: u?.username || "",
      email: u?.email || "",
      telefono: u?.telefono || "",
    });
  }, [ctxUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const direccionActual = useMemo(
    () => user?.direccion || "Sin dirección actual",
    [user]
  );

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // Construye un SessionUser actualizado a partir del doc de Firestore
  const rebuildSessionUser = (prev, profile) => {
    const p = profile || {};
    const addresses = Array.isArray(p.addresses) ? p.addresses : [];
    const def = addresses.find(a => a?.isDefault) || addresses[0] || null;

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

      // Compat barra dirección
      direccion: def?.address || p.direccion || prev?.direccion || "",
      direccion2: p.direccion2 || prev?.direccion2 || "",
      direccion3: p.direccion3 || prev?.direccion3 || "",
      direccion4: p.direccion4 || prev?.direccion4 || "",
      direccion5: p.direccion5 || prev?.direccion5 || "",

      addresses,
      createdAt: p.createdAt || prev?.createdAt || null,
      updatedAt: p.updatedAt || Date.now(),
      lastSynced: Date.now(),
      version: (prev?.version || 1),
    };
  };

  // Guardar perfil (nombre, teléfono) en Firestore y refrescar sesión
  const saveProfile = async () => {
    if (!user?.uid) return alert("No hay sesión activa.");
    const telDigits = String(form.telefono || "").replace(/\D/g, "");
    if (telDigits && telDigits.length < 6) {
      return alert("Ingresá un teléfono válido (solo números, sin 0 y sin 15).");
    }

    setLoading(true);
    try {
      // 1) Guardar en Firestore (merge)
      const ref = doc(db, "userswebapp", user.uid);
      await setDoc(ref, {
        nombre: form.nombre.trim(),
        telefono: telDigits,
        updatedAt: Date.now(),
      }, { merge: true });

      // 2) Actualizar displayName en Auth (opcional)
      try {
        await updateProfile(auth.currentUser, {
          displayName: form.nombre.trim() || auth.currentUser?.displayName || "",
        });
      } catch {}

      // 3) Leer perfil actualizado para reconstruir SessionUser
      const snap = await getDoc(ref);
      const refreshed = rebuildSessionUser(user, snap.exists() ? snap.data() : {});
      setUser(refreshed);
      try { localStorage.setItem("SessionUser", JSON.stringify(refreshed)); } catch {}
      if (typeof setSessionUser === "function") setSessionUser(refreshed);

      alert("Perfil actualizado.");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar. Reintentá.");
    } finally {
      setLoading(false);
    }
  };

  const toggleShow = () => setPwForm((s) => ({ ...s, show: !s.show }));

  // Cambiar contraseña real (reauth + updatePassword)
  const changePassword = async () => {
    const { current, next, repeat } = pwForm;
    if (!next || !repeat) return alert("Completá los campos de nueva contraseña.");
    if (next.length < 8) return alert("La nueva contraseña debe tener al menos 8 caracteres.");
    if (next !== repeat) return alert("La repetición no coincide.");
    if (!auth.currentUser?.email) return alert("No se puede cambiar la contraseña sin email en la sesión.");

    setLoading(true);
    try {
      // Reautenticar con contraseña actual
      const cred = EmailAuthProvider.credential(auth.currentUser.email, current || "");
      await reauthenticateWithCredential(auth.currentUser, cred);

      // Actualizar password
      await updatePassword(auth.currentUser, next);

      setPwForm({ current: "", next: "", repeat: "", show: false });
      alert("Contraseña actualizada.");
    } catch (e) {
      console.error(e);
      let msg = "No se pudo actualizar la contraseña.";
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        msg = "La contraseña actual no es correcta.";
      } else if (e.code === "auth/weak-password") {
        msg = "La nueva contraseña es demasiado débil.";
      } else if (e.code === "auth/too-many-requests") {
        msg = "Demasiados intentos. Probá más tarde.";
      } else if (e.code === "auth/requires-recent-login") {
        msg = "Por seguridad, volvé a iniciar sesión e intentá de nuevo.";
      }
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async () => {
    if (!form.email) return alert("No hay email cargado.");
    try {
      await sendPasswordResetEmail(auth, form.email);
      alert("Te enviamos un email para reestablecer la contraseña.");
    } catch (e) {
      console.error(e);
      alert("No se pudo enviar el correo de reestablecimiento.");
    }
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mi perfil</h1>
        <p className={styles.subtitle}>Tus datos de cuenta</p>
      </header>

      <main className={styles.main}>
        {/* Avatar + Nombre corto */}
        <section className={styles.card}>
          <div className={styles.rowA}>
            <div className={styles.avatar} aria-hidden="true">
              {form?.nombre?.[0]?.toUpperCase() || form?.username?.[0]?.toUpperCase() || "U"}
            </div>
            <div className={styles.idInfo}>
              <div className={styles.nameStrong}>{form.nombre || "Sin nombre"}</div>
              <div className={styles.userMeta}>@{form.username || "usuario"}</div>
            </div>
          </div>
        </section>

        {/* Datos básicos */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Datos personales</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="nombre">Nombre y apellido</label>
            <input
              id="nombre"
              className={styles.input}
              value={form.nombre}
              onChange={(e) => onChange("nombre", e.target.value)}
              placeholder="Ej: Nicolás Pérez"
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="username">Usuario</label>
              <input
                id="username"
                className={styles.input}
                value={form.username}
                onChange={(e) => onChange("username", e.target.value)}
                placeholder="nick"
                readOnly // ← username indexado: no editable
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                className={styles.input}
                value={form.telefono}
                onChange={(e) => onChange("telefono", e.target.value)}
                placeholder="+54 9 ..."
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="usuario@mail.com"
              readOnly // ← el email lo maneja Auth
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.saveBtn} onClick={saveProfile} disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </section>

        {/* Dirección actual */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Dirección actual</h2>
          <div className={styles.addrBox}>
            <span className={styles.addrPin} aria-hidden="true">📍</span>
            <div className={styles.addrText}>{direccionActual}</div>
          </div>
          <div className={styles.actionsRight}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => navigate("/direcciones")}
            >
              Gestionar direcciones
            </button>
          </div>
        </section>

        {/* Cambiar contraseña */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Cambiar contraseña</h2>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="curr">Contraseña actual</label>
            <input
              id="curr"
              className={styles.input}
              type={pwForm.show ? "text" : "password"}
              value={pwForm.current}
              onChange={(e) => setPwForm((s) => ({ ...s, current: e.target.value }))}
              placeholder="••••••••"
            />
          </div>

          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="next">Nueva contraseña</label>
              <input
                id="next"
                className={styles.input}
                type={pwForm.show ? "text" : "password"}
                value={pwForm.next}
                onChange={(e) => setPwForm((s) => ({ ...s, next: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="repeat">Repetir nueva</label>
              <input
                id="repeat"
                className={styles.input}
                type={pwForm.show ? "text" : "password"}
                value={pwForm.repeat}
                onChange={(e) => setPwForm((s) => ({ ...s, repeat: e.target.value }))}
                placeholder="Repetí la nueva"
              />
            </div>
          </div>

          <label className={styles.chk}>
            <input type="checkbox" checked={pwForm.show} onChange={() => setPwForm((s) => ({ ...s, show: !s.show }))} />
            <span>Mostrar contraseñas</span>
          </label>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={changePassword} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
          <p className={styles.note}>
            ¿Preferís no escribir la actual?{" "}
            <button type="button" className={styles.linkBtn} onClick={sendReset}>
              Reestablecer por email
            </button>
          </p>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
