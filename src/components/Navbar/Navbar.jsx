/*
import React, { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Navbar.module.css";
import { Modal } from "../Modal/Modal";

export function Navbar({
  greeting = "¡Hola!",
  links = [
    { label: "Link 1", to: "#" },
    { label: "Link 2", to: "#" },
    { label: "Link 3", to: "#" },
    { label: "Link 4", to: "#" },
    { label: "Link 5", to: "#" },
  ],
}) {
  const [open, setOpen] = useState(false);       // menú hamburguesa
  const [confirmOpen, setConfirmOpen] = useState(false); // modal logout
  const menuId = useId();
  const navigate = useNavigate();

  const toggleMenu = () => setOpen((v) => !v);
  const closeMenu = () => setOpen(false);

  const askLogout = () => setConfirmOpen(true);
  const cancelLogout = () => setConfirmOpen(false);

  const confirmLogout = () => {
    // Limpia sesión y va a login
    try { localStorage.removeItem("SessionUser"); } catch {}
    setConfirmOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className={styles.wrapper}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Abrir menú"
          aria-controls={menuId}
          aria-expanded={open}
          onClick={toggleMenu}
        >
          {burgerIcon}
        </button>

        <div className={styles.centerText} title="Saludo">
          {greeting}
        </div>

        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Cerrar sesión"
          onClick={askLogout}
        >
          {logoutIcon}
        </button>
      </div>

      
      <nav
        id={menuId}
        className={`${styles.menu} ${open ? styles.menuOpen : ""}`}
        aria-hidden={!open}
      >
        <ul className={styles.menuList}>
          {links.map((lk, i) => (
            <li key={i} className={styles.menuItem}>
              <a href={lk.to} onClick={closeMenu}>{lk.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {open && (
        <button
          type="button"
          className={styles.backdrop}
          onClick={closeMenu}
          aria-label="Cerrar menú"
        />
      )}

      <Modal open={confirmOpen} title="Cerrar sesión" onClose={cancelLogout}>
        <p style={{ marginBottom: 12 }}>¿Seguro que querés cerrar sesión?</p>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={cancelLogout}>
            No
          </button>
          <button type="button" className={styles.btnPrimary} onClick={confirmLogout}>
            Sí, cerrar
          </button>
        </div>
      </Modal>
    </header>
  );
}

const burgerIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const logoutIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);
*/
import React, { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Navbar.module.css";
import { Modal } from "../Modal/Modal";

// 👇 NUEVO: usamos el provider y signOut de Firebase
import { useAuth } from "../../state/AuthProvider";
import { auth } from "../../services/firebase";
import { signOut } from "firebase/auth";

export function Navbar({
  greeting = "¡Hola!",
  links = [
    { label: "Link 1", to: "#" },
    { label: "Link 2", to: "#" },
    { label: "Link 3", to: "#" },
    { label: "Link 4", to: "#" },
    { label: "Link 5", to: "#" },
  ],
}) {
  const [open, setOpen] = useState(false);       // menú hamburguesa
  const [confirmOpen, setConfirmOpen] = useState(false); // modal logout
  const menuId = useId();
  const navigate = useNavigate();

  // 👇 del AuthProvider (para limpiar user en contexto)
  const { setSessionUser } = useAuth?.() || { setSessionUser: null };

  const toggleMenu = () => setOpen((v) => !v);
  const closeMenu = () => setOpen(false);

  const askLogout = () => setConfirmOpen(true);
  const cancelLogout = () => setConfirmOpen(false);

  const confirmLogout = async () => {
    try {
      // 1) Firebase Auth
      await signOut(auth);

      // 2) Contexto
      if (typeof setSessionUser === "function") {
        setSessionUser(null);
      }

      // 3) Cache local
      try { localStorage.removeItem("SessionUser"); } catch {}

      // 4) Cerrar modales/menú y navegar
      setOpen(false);
      setConfirmOpen(false);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      // fallback: al menos limpiamos local y navegamos
      try { localStorage.removeItem("SessionUser"); } catch {}
      if (typeof setSessionUser === "function") setSessionUser(null);
      setOpen(false);
      setConfirmOpen(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className={styles.wrapper}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Abrir menú"
          aria-controls={menuId}
          aria-expanded={open}
          onClick={toggleMenu}
        >
          {burgerIcon}
        </button>

        <div className={styles.centerText} title="Saludo">
          {greeting}
        </div>

        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Cerrar sesión"
          onClick={askLogout}
        >
          {logoutIcon}
        </button>
      </div>

      {/* Menú desplegable */}
      <nav
        id={menuId}
        className={`${styles.menu} ${open ? styles.menuOpen : ""}`}
        aria-hidden={!open}
      >
        <ul className={styles.menuList}>
          {links.map((lk, i) => (
            <li key={i} className={styles.menuItem}>
              <a href={lk.to} onClick={closeMenu}>{lk.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {open && (
        <button
          type="button"
          className={styles.backdrop}
          onClick={closeMenu}
          aria-label="Cerrar menú"
        />
      )}

      {/* Modal de confirmación */}
      <Modal open={confirmOpen} title="Cerrar sesión" onClose={cancelLogout}>
        <p style={{ marginBottom: 12 }}>¿Seguro que querés cerrar sesión?</p>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={cancelLogout}>
            No
          </button>
          <button type="button" className={styles.btnPrimary} onClick={confirmLogout}>
            Sí, cerrar
          </button>
        </div>
      </Modal>
    </header>
  );
}

/* Iconos inline */
const burgerIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const logoutIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);
