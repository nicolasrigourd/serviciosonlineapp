// src/services/quickSlots.js
const key = (uid) => `QuickSlots_${uid}`;

export function getQuickSlots(uid) {
  try { return JSON.parse(localStorage.getItem(key(uid)) || "[]"); } catch { return []; }
}
export function setQuickSlots(uid, ids = []) {
  localStorage.setItem(key(uid), JSON.stringify(ids.slice(0, 4)));
}
export function toggleQuickSlot(uid, addressId) {
  const cur = new Set(getQuickSlots(uid));
  cur.has(addressId) ? cur.delete(addressId) : cur.add(addressId);
  setQuickSlots(uid, Array.from(cur));
  return getQuickSlots(uid);
}
export function isQuick(uid, addressId) {
  return getQuickSlots(uid).includes(addressId);
}
