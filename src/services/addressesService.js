// src/services/addressesService.js
import { db } from "./firebase";
import {
  doc, runTransaction, serverTimestamp, getDoc, updateDoc
} from "firebase/firestore";

function buildSessionUserFrom(prevSessionUser, nextAddresses) {
  const def = Array.isArray(nextAddresses)
    ? nextAddresses.find(a => a?.isDefault)
    : null;

  return {
    ...prevSessionUser,
    addresses: nextAddresses,
    direccion: def?.address || prevSessionUser?.direccion || "",
    lastSynced: Date.now(),
  };
}

export async function addAddress(uid, payload, prevSessionUser) {
  const ref = doc(db, "userswebapp", uid);
  let nextAddresses = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const data = snap.data() || {};
    const addresses = Array.isArray(data.addresses) ? [...data.addresses] : [];

    const base = payload?.isDefault
      ? addresses.map(a => ({ ...a, isDefault: false }))
      : addresses;

    nextAddresses = [...base, payload];

    tx.update(ref, {
      addresses: nextAddresses,
      updatedAt: serverTimestamp(),
    });
  });

  const nextSessionUser = buildSessionUserFrom(prevSessionUser, nextAddresses);
  localStorage.setItem("SessionUser", JSON.stringify(nextSessionUser));
  return nextSessionUser;
}

export async function editAddress(uid, addressId, patch, prevSessionUser) {
  const ref = doc(db, "userswebapp", uid);
  let nextAddresses = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const data = snap.data() || {};
    const addresses = Array.isArray(data.addresses) ? [...data.addresses] : [];

    const idx = addresses.findIndex(a => a?.id === addressId);
    if (idx === -1) throw new Error("ADDRESS_NOT_FOUND");

    let updated = { ...addresses[idx], ...patch };

    // Si en el patch viene isDefault=true, desmarcamos los demás
    if (patch.hasOwnProperty("isDefault") && patch.isDefault === true) {
      nextAddresses = addresses.map(a => ({ ...a, isDefault: false }));
      nextAddresses[idx] = { ...updated, isDefault: true };
    } else {
      nextAddresses = addresses.slice();
      nextAddresses[idx] = updated;
    }

    tx.update(ref, {
      addresses: nextAddresses,
      updatedAt: serverTimestamp(),
    });
  });

  const nextSessionUser = buildSessionUserFrom(prevSessionUser, nextAddresses);
  localStorage.setItem("SessionUser", JSON.stringify(nextSessionUser));
  return nextSessionUser;
}

export async function setDefaultAddress(uid, addressId, prevSessionUser) {
  const ref = doc(db, "userswebapp", uid);
  let nextAddresses = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const data = snap.data() || {};
    const addresses = Array.isArray(data.addresses) ? [...data.addresses] : [];
    if (!addresses.length) throw new Error("NO_ADDRESSES");

    nextAddresses = addresses.map(a => ({
      ...a,
      isDefault: a.id === addressId,
    }));

    tx.update(ref, {
      addresses: nextAddresses,
      updatedAt: serverTimestamp(),
    });
  });

  const nextSessionUser = buildSessionUserFrom(prevSessionUser, nextAddresses);
  localStorage.setItem("SessionUser", JSON.stringify(nextSessionUser));
  return nextSessionUser;
}

export async function removeAddress(uid, addressId, prevSessionUser) {
  const ref = doc(db, "userswebapp", uid);
  let nextAddresses = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const data = snap.data() || {};
    const addresses = Array.isArray(data.addresses) ? [...data.addresses] : [];

    const victim = addresses.find(a => a?.id === addressId);
    if (!victim) {
      nextAddresses = addresses;
    } else {
      nextAddresses = addresses.filter(a => a?.id !== addressId);
      // si borraste la default, promover la primera (si existe)
      if (victim.isDefault && nextAddresses.length) {
        nextAddresses = nextAddresses.map((a, i) => ({ ...a, isDefault: i === 0 }));
      }
    }

    tx.update(ref, {
      addresses: nextAddresses,
      updatedAt: serverTimestamp(),
    });
  });

  const nextSessionUser = buildSessionUserFrom(prevSessionUser, nextAddresses);
  localStorage.setItem("SessionUser", JSON.stringify(nextSessionUser));
  return nextSessionUser;
}

// Refresh desde Firestore (si necesitás forzar relectura)
export async function refreshAddresses(uid, prevSessionUser) {
  const ref = doc(db, "userswebapp", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
  const data = snap.data() || {};
  const nextAddresses = Array.isArray(data.addresses) ? data.addresses : [];
  const nextSessionUser = buildSessionUserFrom(prevSessionUser, nextAddresses);
  localStorage.setItem("SessionUser", JSON.stringify(nextSessionUser));
  return nextSessionUser;
}

// Guarda quickSlots en Firestore (opcional, si querés sync multi-dispositivo)
export async function saveQuickSlots(uid, ids = []) {
  const ref = doc(db, "userswebapp", uid);
  await updateDoc(ref, { quickSlots: ids.slice(0, 4), updatedAt: serverTimestamp() });
}
