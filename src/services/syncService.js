import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "./firebase";
import { clienteDb } from "../db/clienteDb";

let _unsubs    = [];
let _activeUid = null;      // evita reiniciar si ya está corriendo para este uid

// ── Promesa para el primer snapshot del perfil ─────────────────
let _profilePromise  = null;
let _profileResolve  = null;

function _resetProfilePromise() {
  _profilePromise = new Promise((resolve) => {
    _profileResolve = resolve;
  });
}

// ── API pública ────────────────────────────────────────────────

export function startSync(uid) {
  if (!uid) return;
  if (_activeUid === uid) return;   // ya syncing para este usuario
  stopSync();
  _activeUid = uid;
  _unsubs.push(
    _syncProfile(uid),
    _syncOrderTypes(),
    _syncPricing(),
    _syncOrders(uid),
  );
}

export function stopSync() {
  _unsubs.forEach((fn) => fn());
  _unsubs      = [];
  _activeUid   = null;
  if (_profileResolve) {
    _profileResolve(null);   // desbloquea cualquier waitForProfile pendiente
    _profileResolve = null;
  }
  _profilePromise = null;
}

/**
 * Devuelve una Promise que resuelve con los datos del perfil
 * en cuanto el primer onSnapshot los escribe en IndexedDB.
 * Si no llega en `ms` milisegundos, resuelve con null.
 */
export function waitForProfile(ms = 7000) {
  if (!_profilePromise) return Promise.resolve(null);
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([_profilePromise, timeout]);
}

// ── Listeners internos ─────────────────────────────────────────

function _syncProfile(uid) {
  _resetProfilePromise();
  const ref = doc(db, "userswebapp", uid);

  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data = { _key: "me", ...snap.data() };
    clienteDb.profile.put(data)
      .then(() => {
        if (_profileResolve) {
          _profileResolve(data);
          _profileResolve = null;
        }
      })
      .catch(() => {});
  });
}

function _syncOrderTypes() {
  const ref = collection(db, "orderTypes");
  return onSnapshot(ref, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    clienteDb.orderTypes.bulkPut(docs).catch(() => {});
  });
}

function _syncPricing() {
  const ref = doc(db, "config", "pricing");
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    clienteDb.pricing.put({ key: "pricing", ...snap.data() }).catch(() => {});
  });
}

function _syncOrders(uid) {
  let firstSnapshot = true;
  const ref = query(
    collection(db, "orders"),
    where("customerUid", "==", uid),
  );
  return onSnapshot(ref, (snap) => {
    // En el primer snapshot reconciliamos: cualquier pedido en IndexedDB que
    // Firestore ya no devuelve fue borrado mientras la app estaba cerrada.
    if (firstSnapshot) {
      firstSnapshot = false;
      const firestoreIds = new Set(snap.docs.map((d) => d.id));
      clienteDb.orders.toArray()
        .then((local) => {
          const toDelete = local
            .map((o) => o.orderId)
            .filter((id) => id && !firestoreIds.has(id));
          if (toDelete.length) clienteDb.orders.bulkDelete(toDelete).catch(() => {});
        })
        .catch(() => {});
    }

    snap.docChanges().forEach((change) => {
      const data = { ...change.doc.data(), orderId: change.doc.id };
      if (change.type === "removed") {
        clienteDb.orders.delete(change.doc.id).catch(() => {});
      } else {
        clienteDb.orders.put(data).catch(() => {});
      }
    });
  });
}
