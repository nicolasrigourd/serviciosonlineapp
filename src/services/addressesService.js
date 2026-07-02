import { db } from "./firebase";
import { clienteDb } from "../db/clienteDb";
import {
  doc, runTransaction, serverTimestamp, getDoc, updateDoc,
} from "firebase/firestore";

// Parcha el campo `addresses` en el perfil local (IndexedDB) y retorna el perfil actualizado
async function _patchProfileAddresses(nextAddresses) {
  const existing = (await clienteDb.profile.get("me")) || {};
  const def = Array.isArray(nextAddresses)
    ? nextAddresses.find((a) => a?.isDefault)
    : null;
  const patched = {
    ...existing,
    _key: "me",
    addresses: nextAddresses,
    direccion: def?.address || existing?.direccion || "",
  };
  await clienteDb.profile.put(patched);
  return patched;
}

export async function addAddress(uid, payload) {
  const ref = doc(db, "userswebapp", uid);
  let nextAddresses = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const addresses = Array.isArray(snap.data().addresses) ? [...snap.data().addresses] : [];

    const base = payload?.isDefault
      ? addresses.map((a) => ({ ...a, isDefault: false }))
      : addresses;

    nextAddresses = [...base, payload];
    tx.update(ref, { addresses: nextAddresses, updatedAt: serverTimestamp() });
  });

  return await _patchProfileAddresses(nextAddresses);
}

export async function editAddress(uid, addressId, patch) {
  const ref = doc(db, "userswebapp", uid);
  let nextAddresses = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const addresses = Array.isArray(snap.data().addresses) ? [...snap.data().addresses] : [];

    const idx = addresses.findIndex((a) => a?.id === addressId);
    if (idx === -1) throw new Error("ADDRESS_NOT_FOUND");

    if (patch.isDefault === true) {
      nextAddresses = addresses.map((a) => ({ ...a, isDefault: false }));
      nextAddresses[idx] = { ...addresses[idx], ...patch, isDefault: true };
    } else {
      nextAddresses = addresses.slice();
      nextAddresses[idx] = { ...addresses[idx], ...patch };
    }

    tx.update(ref, { addresses: nextAddresses, updatedAt: serverTimestamp() });
  });

  return await _patchProfileAddresses(nextAddresses);
}

export async function setDefaultAddress(uid, addressId) {
  const ref = doc(db, "userswebapp", uid);
  let nextAddresses = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const addresses = Array.isArray(snap.data().addresses) ? [...snap.data().addresses] : [];
    if (!addresses.length) throw new Error("NO_ADDRESSES");

    nextAddresses = addresses.map((a) => ({ ...a, isDefault: a.id === addressId }));
    tx.update(ref, { addresses: nextAddresses, updatedAt: serverTimestamp() });
  });

  return await _patchProfileAddresses(nextAddresses);
}

export async function removeAddress(uid, addressId) {
  const ref = doc(db, "userswebapp", uid);
  let nextAddresses = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
    const addresses = Array.isArray(snap.data().addresses) ? [...snap.data().addresses] : [];

    const victim = addresses.find((a) => a?.id === addressId);
    if (!victim) {
      nextAddresses = addresses;
    } else {
      nextAddresses = addresses.filter((a) => a?.id !== addressId);
      if (victim.isDefault && nextAddresses.length) {
        nextAddresses = nextAddresses.map((a, i) => ({ ...a, isDefault: i === 0 }));
      }
    }

    tx.update(ref, { addresses: nextAddresses, updatedAt: serverTimestamp() });
  });

  return await _patchProfileAddresses(nextAddresses);
}

export async function refreshAddresses(uid) {
  const ref = doc(db, "userswebapp", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("USERDOC_NOT_FOUND");
  const nextAddresses = Array.isArray(snap.data().addresses) ? snap.data().addresses : [];
  return await _patchProfileAddresses(nextAddresses);
}

export async function saveQuickSlots(uid, ids = []) {
  const ref = doc(db, "userswebapp", uid);
  await updateDoc(ref, { quickSlots: ids.slice(0, 4), updatedAt: serverTimestamp() });
}
