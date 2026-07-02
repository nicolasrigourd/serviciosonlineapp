import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { auth, db } from "../services/firebase";
import { startSync, stopSync, waitForProfile } from "../services/syncService";
import { clienteDb } from "../db/clienteDb";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// -------- helpers internos --------

const isEmail = (v) => /\S+@\S+\.\S+/.test(String(v || "").trim());

async function resolveAndValidateToEmail(userOrEmail) {
  const raw = String(userOrEmail || "").trim();

  // Email directo: lo retornamos sin query — signInWithEmailAndPassword
  // lanza auth/user-not-found si no existe. No podemos consultar Firestore
  // aquí porque el usuario todavía no está autenticado.
  if (isEmail(raw)) return raw.toLowerCase();

  // Username: usernames/{username} ya tiene el email guardado desde el registro
  const uname = raw.toLowerCase();
  const unameSnap = await getDoc(doc(db, "usernames", uname));
  if (!unameSnap.exists()) throw new Error("USERNAME_NOT_FOUND");
  const { uid, email } = unameSnap.data() || {};
  if (!uid) throw new Error("USERNAME_WITHOUT_UID");
  if (!email) throw new Error("USERDOC_WITHOUT_EMAIL");
  return String(email).toLowerCase();
}

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
    direccion: defaultAddress,
    direccion2, direccion3, direccion4, direccion5,
    addresses,
    lastSynced: Date.now(),
    version: 1,
  };
}

// -------- Contexto --------

const AuthCtx = createContext({
  user: null,
  loading: true,
  error: "",
  login: async (_u, _p) => {},
  logout: async () => {},
  refreshProfile: async () => {},
  setSessionUser: (_s) => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pre-fill desde IndexedDB al montar (antes de que Firebase auth responda)
  useEffect(() => {
    clienteDb.profile.get("me")
      .then((cached) => {
        if (cached) setUser(buildSessionUser(cached));
      })
      .catch(() => {});
  }, []);

  // Suscripción a Firebase Auth — fuente de verdad
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          startSync(fbUser.uid);
          const cached = await clienteDb.profile.get("me");
          if (cached) {
            setUser(buildSessionUser(cached));
          } else {
            // Sin caché — ir directo a Firestore
            const snap = await getDoc(doc(db, "userswebapp", fbUser.uid));
            if (snap.exists()) {
              setUser(buildSessionUser(snap.data()));
            } else {
              await clienteDb.profile.delete("me").catch(() => {});
              setUser(null);
              stopSync();
            }
          }
        } else {
          await clienteDb.profile.delete("me").catch(() => {});
          setUser(null);
          stopSync();
        }
      } catch (e) {
        console.error("onAuthStateChanged error:", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const setSessionUser = useCallback((next) => {
    const value = typeof next === "function" ? next(user) : next;
    setUser(value);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user?.uid) return null;
    const ref = doc(db, "userswebapp", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const fresh = buildSessionUser(snap.data());
    setUser(fresh);
    return fresh;
  }, [user?.uid]);

  const login = useCallback(async (userOrEmail, password) => {
    setError("");
    await setPersistence(auth, browserLocalPersistence);

    const email = await resolveAndValidateToEmail(userOrEmail);
    const cred = await signInWithEmailAndPassword(auth, email, password);

    startSync(cred.user.uid);

    let fresh = await waitForProfile();
    if (!fresh) {
      const snap = await getDoc(doc(db, "userswebapp", cred.user.uid));
      fresh = snap.exists() ? snap.data() : null;
    }
    if (!fresh) throw new Error("USERDOC_NOT_FOUND");

    const sessionUser = buildSessionUser(fresh);
    setUser(sessionUser);
    return sessionUser;
  }, []);

  const logout = useCallback(async () => {
    stopSync();
    await signOut(auth);
    await clienteDb.profile.delete("me").catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, logout, refreshProfile, setSessionUser }),
    [user, loading, error, login, logout, refreshProfile, setSessionUser]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
