import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { auth, db } from "../services/firebase"; // ⬅️ ajustá la ruta si tu services está en otro nivel
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";

// -------- helpers internos --------

const isEmail = (v) => /\S+@\S+\.\S+/.test(String(v || "").trim());

/** Resuelve "usuario o email" a un email, con validaciones y errores claros */
async function resolveAndValidateToEmail(userOrEmail) {
  const raw = String(userOrEmail || "").trim();
  if (isEmail(raw)) {
    const emailNorm = raw.toLowerCase();
    // chequeo rápido para mensaje claro si no existe
    const col = collection(db, "userswebapp");
    const q = query(col, where("email", "==", emailNorm), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("EMAIL_NOT_FOUND");
    return emailNorm;
  }
  // username
  const uname = raw.toLowerCase();
  const unameRef = doc(db, "usernames", uname);
  const unameSnap = await getDoc(unameRef);
  if (!unameSnap.exists()) throw new Error("USERNAME_NOT_FOUND");
  const { uid } = unameSnap.data() || {};
  if (!uid) throw new Error("USERNAME_WITHOUT_UID");
  const userRef = doc(db, "userswebapp", uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("USERDOC_NOT_FOUND");
  const data = userSnap.data() || {};
  if (!data?.email) throw new Error("USERDOC_WITHOUT_EMAIL");
  return String(data.email).toLowerCase();
}

/** Construye el objeto de sesión local (cache) desde el doc de Firestore */
function buildSessionUser(docData) {
  const {
    uid, email, username, nombre, apellido, telefono, dpto,
    direccion, direccion2 = "", direccion3 = "", direccion4 = "", direccion5 = "",
    addresses = [], userNumber, createdAt,
  } = docData;

  const defaultAddress =
    (Array.isArray(addresses) ? addresses.find((a) => a?.isDefault)?.address : null) ||
    direccion || "";

  return {
    uid,
    email,
    username,
    nombre,
    apellido,
    telefono,
    dpto,
    userNumber,
    createdAt,

    // compat
    direccion: defaultAddress,
    direccion2, direccion3, direccion4, direccion5,

    // normalizado
    addresses,

    // metadatos de cache
    lastSynced: Date.now(),
    version: 1,
  };
}

const SESSION_KEY = "SessionUser";

// -------- Contexto --------

const AuthCtx = createContext({
  user: null,            // SessionUser | null
  loading: true,         // mientras revisa auth inicial / rehidrata
  error: "",             // último error de login si querés mostrar algo global
  login: async (_u, _p) => {},   // (userOrEmail, password)
  logout: async () => {},
  refreshProfile: async () => {}, // re-lee userswebapp/{uid} y actualiza SessionUser
  setSessionUser: (_s) => {},     // opcional: para merges puntuales (editar perfil)
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // SessionUser
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Rehidratar de localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") setUser(parsed);
      }
    } catch {}
  }, []);

  // Suscripción a Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const ref = doc(db, "userswebapp", fbUser.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const sessionUser = buildSessionUser(snap.data());
            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
            setUser(sessionUser);
          } else {
            // está autenticado pero sin perfil → limpiamos el cache
            localStorage.removeItem(SESSION_KEY);
            setUser(null);
          }
        } else {
          // logout / no autenticado
          localStorage.removeItem(SESSION_KEY);
          setUser(null);
        }
      } catch (e) {
        console.error("onAuthStateChanged error:", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Sincronizar entre pestañas (si otra tab modifica SessionUser)
  useEffect(() => {
    const onStorage = (ev) => {
      if (ev.key === SESSION_KEY) {
        try {
          const parsed = ev.newValue ? JSON.parse(ev.newValue) : null;
          setUser(parsed);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSessionUser = useCallback((next) => {
    // next puede ser objeto o updater(prev)
    const value = typeof next === "function" ? next(user) : next;
    setUser(value);
    try {
      if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else localStorage.removeItem(SESSION_KEY);
    } catch {}
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user?.uid) return null;
    const ref = doc(db, "userswebapp", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const fresh = buildSessionUser(snap.data());
    setSessionUser(fresh);
    return fresh;
  }, [user?.uid, setSessionUser]);

  const login = useCallback(async (userOrEmail, password) => {
    setError("");
    // persistencia "recordada"
    await setPersistence(auth, browserLocalPersistence);

    // resolver a email con validaciones claras
    const email = await resolveAndValidateToEmail(userOrEmail);

    // login con Auth
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // traer doc
    const ref = doc(db, "userswebapp", cred.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const sessionUser = buildSessionUser(snap.data());

    // cache local + estado
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);

    return sessionUser;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, logout, refreshProfile, setSessionUser }),
    [user, loading, error, login, logout, refreshProfile, setSessionUser]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
