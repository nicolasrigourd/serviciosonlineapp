import React, { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../../components/BottomNav/BottomNav";
import OrdersDock from "../../components/OrdersDock/OrdersDock";
import { useFlow } from "../../state/FlowContext";
import { useAuth } from "../../state/AuthProvider";
import { useTheme } from "../../hooks/useTheme";
import { clienteDb } from "../../db/clienteDb";
import styles from "./Home.module.css";
import HomeActionCard from "../../components/HomeActionCard/HomeActionCard";
import DeliveryChoiceModal from "../FlowDelivery/DeliveryChoiceModal";

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default function Home() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { user } = auth || {};

  const { setService, setOrigin } = useFlow();

  // Config estática por tipo — ícono, imagen, ruta y flow handler
  // Los datos dinámicos (surcharge, active) vienen de orderTypes en IndexedDB
  const ORDER_TYPE_CONFIG = {
    envio:    { title: "Enviar",   desc: "Artículos pequeños",      icon: simpleIcon,  image: "/imgs/services/envios.webp",   flow: "envio" },
    retiro:   { title: "Retirar",  desc: "Buscamos y te llevamos",  icon: boxIcon,     image: "/imgs/services/retiros.webp",  flow: "retiro" },
    delivery: { title: "Delivery", desc: "Comidas y restaurantes",  icon: foodIcon,    image: "/imgs/services/delivery.webp", flow: "delivery" },
    compras:  { title: "Compras",  desc: "Te hacemos el mandado",   icon: cartIcon,    image: "/imgs/services/compras.webp",  flow: "compras" },
    valores:  { title: "Valores",  desc: "Dinero o frágiles",       icon: valoresIcon, image: "/imgs/services/dinero.webp",   flow: "valores", badge: "Seguro" },
  };
  const DISPLAY_ORDER = ["envio", "retiro", "delivery", "compras", "valores"];

  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen]             = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [serviceCards, setServiceCards]           = useState([]);

  const profileMenuRef = useRef(null);

  const { addrLabel, addrLat, addrLng, addrExtra } = useMemo(() => {
    if (!user) return { addrLabel: "", addrLat: null, addrLng: null, addrExtra: "" };

    if (Array.isArray(user.addresses) && user.addresses.length) {
      const def = user.addresses.find((a) => a?.isDefault) || user.addresses[0];
      const base = def?.address || "";
      const piso = def?.piso ? `, ${def.piso}` : "";
      return {
        addrLabel:  base ? `${base}${piso}` : "",
        addrLat:    def?.lat ?? null,
        addrLng:    def?.lng ?? null,
        addrExtra:  def?.descripcion || def?.referencia || "",
      };
    }

    if (user.direccion) {
      return {
        addrLabel:  user.direccion,
        addrLat:    null,
        addrLng:    null,
        addrExtra:  user.direccionDescripcion || user.direccionReferencia || "",
      };
    }

    return { addrLabel: "", addrLat: null, addrLng: null, addrExtra: "" };
  }, [user]);

  const hasUsableAddress = Boolean(addrLabel) && addrLat != null && addrLng != null;

  const avatarLetter =
    user?.nombre?.charAt(0)?.toUpperCase() ||
    user?.username?.charAt(0)?.toUpperCase() ||
    "U";

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cargar tipos de servicio desde IndexedDB (sincronizados desde Firestore)
  useEffect(() => {
    clienteDb.orderTypes.toArray()
      .then((docs) => {
        const sorted = DISPLAY_ORDER
          .map((id) => docs.find((d) => d.id === id))
          .filter(Boolean)
          .map((ot) => ({
            key:        ot.id,
            serviceKey: ot.id,
            flow:       ORDER_TYPE_CONFIG[ot.id]?.flow || "envio",
            title:      ORDER_TYPE_CONFIG[ot.id]?.title || ot.id,
            desc:       ORDER_TYPE_CONFIG[ot.id]?.desc  || "",
            icon:       ORDER_TYPE_CONFIG[ot.id]?.icon  || null,
            image:      ORDER_TYPE_CONFIG[ot.id]?.image || null,
            badge:      ot.active === false ? "No disponible" : (ORDER_TYPE_CONFIG[ot.id]?.badge || null),
            disabled:   ot.active === false,
            surcharge:  ot.surcharge || 0,
          }));
        setServiceCards(sorted);
      })
      .catch(() => {});
  }, []);


  // Navegación
  const goAddresses = () => { setProfileOpen(false); navigate("/direcciones"); };
  const goProfile   = () => { setProfileOpen(false); navigate("/perfil"); };
  const goNotifications = () => console.log("[HOME] Notificaciones pendiente");

  const handleLogout = async () => {
    setProfileOpen(false);
    try { await auth.logout(); } catch (e) { console.error("[HOME] logout:", e); }
    navigate("/login", { replace: true });
  };

  // Validar dirección antes de iniciar un servicio
  const validateAddress = () => {
    if (!addrLabel) {
      alert("Primero agregá una dirección principal para poder pedir un servicio.");
      navigate("/direcciones");
      return false;
    }
    if (!hasUsableAddress) {
      alert("Tu dirección no tiene ubicación GPS confirmada. Actualizala para calcular el pedido correctamente.");
      navigate("/direcciones");
      return false;
    }
    return true;
  };

  const pickService = (type, surcharge) => {
    if (!validateAddress()) return;
    // El nuevo FlowEnvio hace su propio resetDraft y setup al montar
    navigate("/flow/envio");
  };

  const pickRetiro = () => {
    if (!validateAddress()) return;
    navigate("/flow/retiro");
  };

  const pickDelivery = () => {
    if (!validateAddress()) return;
    setDeliveryModalOpen(true);
  };

  const handleDeliveryChoose = (mode) => {
    setDeliveryModalOpen(false);
    navigate(mode === "retiro" ? "/flow/retiro" : "/flow/envio");
  };

  const pickCompras = () => {
    if (!validateAddress()) return;
    navigate("/flow/compras");
  };

  const pickValores = () => {
    if (!validateAddress()) return;
    navigate("/flow/valores");
  };

  const handleServiceClick = (action) => {
    if (action.flow === "retiro") {
      pickRetiro();
    } else if (action.flow === "delivery") {
      pickDelivery();
    } else if (action.flow === "compras") {
      pickCompras();
    } else if (action.flow === "valores") {
      pickValores();
    } else {
      pickService(action.serviceKey || action.key, action.surcharge);
    }
  };


  return (
    <div className={styles.homeRoot}>
      <main className={styles.homeMain}>

        {/* ── Zona superior fija ── */}
        <div className={styles.top}>

          <div className={styles.topBar}>
            <div className={styles.profileWrapper} ref={profileMenuRef}>
              <button
                type="button"
                className={styles.homeAvatar}
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="Abrir menú de perfil"
              >
                {user?.photoURL
                  ? <img src={user.photoURL} alt="Usuario" />
                  : <span>{avatarLetter}</span>
                }
              </button>

              {profileOpen && (
                <div className={styles.profileMenu}>
                  <button type="button" onClick={() => { toggleTheme(); setProfileOpen(false); }}>
                    <span className={styles.profileMenuIcon}>
                      {theme === "dark" ? sunIcon : moonIcon}
                    </span>
                    <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
                  </button>
                  <button type="button" onClick={goProfile}>
                    <span className={styles.profileMenuIcon}>{userIcon}</span>
                    <span>Mi perfil</span>
                  </button>
                  <button type="button" onClick={goAddresses}>
                    <span className={styles.profileMenuIcon}>{pinIcon}</span>
                    <span>Mis direcciones</span>
                  </button>
                  <button type="button" className={styles.logoutOption} onClick={handleLogout}>
                    <span className={styles.profileMenuIcon}>{logoutIcon}</span>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>

            <div className={styles.greeting}>
              <small>{getTimeGreeting()}</small>
              <strong>¡Hola, {user?.nombre || user?.username || ""}!</strong>
            </div>

            <button
              type="button"
              className={styles.bellBtn}
              onClick={goNotifications}
              aria-label="Notificaciones"
            >
              {bellIcon}
              <span className={styles.bellDot} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className={`${styles.addrCard} ${!hasUsableAddress ? styles.addrCardWarning : ""}`}
            onClick={goAddresses}
          >
            <span className={styles.addrIcon}>{pinIcon}</span>
            <span className={styles.addrText}>
              <small>Enviar desde</small>
              <span>{addrLabel || "Elegí tu dirección principal"}</span>
              {addrExtra && <em>{addrExtra}</em>}
            </span>
            <span className={styles.addrChevron}>{chevIcon}</span>
          </button>

        </div>

        {/* ── Contenido scrollable ── */}
        <section className={styles.homeContent}>
          <div className={styles.homeLayout}>

            <section className={styles.servicesPanel} aria-label="Tipos de servicio">
              <div className={styles.servicesHeader}>
                <span className={styles.sectionKicker}>Servicios</span>
                <h1>¿Qué necesitás hoy?</h1>
                <p>Elegí el tipo de pedido para continuar.</p>
              </div>

              <div className={styles.actionsGrid}>
                {serviceCards.map((a) => (
                  <HomeActionCard
                    key={a.key}
                    icon={a.icon}
                    image={a.image}
                    title={a.title}
                    desc={a.desc}
                    tone="neutral"
                    badge={a.badge}
                    disabled={a.disabled}
                    onClick={() => handleServiceClick(a)}
                  />
                ))}
              </div>
            </section>

            <section className={styles.carouselSection} aria-label="Opciones rápidas">
              <div className={styles.carouselHeader}>
                <span>Opciones rápidas</span>
                <strong>Novedades</strong>
              </div>

              <div className={styles.carouselTrack}>
                <article className={styles.carouselCard}>
                  <div>
                    <span>Rápido</span>
                    <h2>Enviá documentos o llaves</h2>
                    <p>Ideal para gestiones dentro de la ciudad.</p>
                  </div>
                  <button type="button" onClick={() => pickService("simple", 0)}>Enviar</button>
                </article>

                <article className={styles.carouselCard}>
                  <div>
                    <span>Retiro</span>
                    <h2>Buscamos por vos</h2>
                    <p>Indicá dónde retirar y te lo llevamos a tu dirección.</p>
                  </div>
                  <button type="button" onClick={() => pickRetiro("simple", 0.07)}>Retirar</button>
                </article>

                <article className={styles.carouselCard}>
                  <div>
                    <span>Seguro</span>
                    <h2>Valores o delicados</h2>
                    <p>Para envíos que requieren más cuidado.</p>
                  </div>
                  <button type="button" onClick={pickValores}>Ver</button>
                </article>
              </div>
            </section>

            <section className={styles.infoBanner} aria-label="Información">
              <div className={styles.infoIcon}>{clockIcon}</div>
              <div className={styles.infoText}>
                <strong>Envíos rápidos y seguros</strong>
                <span>Coordinamos tu pedido con repartidores disponibles.</span>
              </div>
            </section>

          </div>
        </section>

      </main>

      <OrdersDock />
      <BottomNav />

      {deliveryModalOpen && (
        <DeliveryChoiceModal
          onChoose={handleDeliveryChoose}
          onClose={() => setDeliveryModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Íconos ───────────────────────────────────────────────────────

const pinIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const chevIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const bellIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M10.3 21a2 2 0 0 0 3.4 0" />
  </svg>
);

const clockIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const simpleIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 8l9 6 9-6" />
  </svg>
);

const boxIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96L12 12l8.73-5.04" />
  </svg>
);

const valoresIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8M12 8v8" />
  </svg>
);

const foodIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 3h16l-1 7H5L4 3z" />
    <path d="M7 16h10" />
    <circle cx="7" cy="19" r="2" />
    <circle cx="17" cy="19" r="2" />
  </svg>
);

const cartIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);

const userIcon = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const logoutIcon = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

const sunIcon = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const moonIcon = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
  </svg>
);
