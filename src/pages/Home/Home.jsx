import React, { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../../components/BottomNav/BottomNav";
import ActiveOrderSheet from "../../components/ActiveOrderSheet/ActiveOrderSheet";
import { useFlow } from "../../state/FlowContext";
import { useAuth } from "../../state/AuthProvider";
import styles from "./Home.module.css";
import HomeActionCard from "../../components/HomeActionCard/HomeActionCard";

function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem("SessionUser") || "null");
  } catch {
    return null;
  }
}

function hasActiveOrderInStorage() {
  try {
    const raw = localStorage.getItem("NuevoPedido");
    if (!raw) return false;

    const pedido = JSON.parse(raw);
    if (!pedido) return false;

    const status = String(pedido.status || "").toLowerCase();
    const currentStep = String(pedido.currentStep || "").toLowerCase();

    if (status === "finalizado") return false;
    if (status === "cancelado") return false;
    if (currentStep === "delivered") return false;

    return Boolean(pedido.id || pedido.orderId);
  } catch {
    return false;
  }
}

export default function Home() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { user: ctxUser } = auth || {};
  const { setService, setOrigin } = useFlow();

  const [profileOpen, setProfileOpen] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(() =>
    hasActiveOrderInStorage()
  );

  const profileMenuRef = useRef(null);

  const cachedUser = getCachedUser();
  const user = ctxUser || cachedUser;

  const { addrLabel, addrLat, addrLng, addrExtra } = useMemo(() => {
    if (!user) {
      return {
        addrLabel: "",
        addrLat: null,
        addrLng: null,
        addrExtra: "",
      };
    }

    if (Array.isArray(user.addresses) && user.addresses.length) {
      const def = user.addresses.find((a) => a?.isDefault) || user.addresses[0];

      const base = def?.address || "";
      const piso = def?.piso ? `, ${def.piso}` : "";
      const descripcion = def?.descripcion ? def.descripcion : "";
      const referencia = def?.referencia ? def.referencia : "";

      return {
        addrLabel: base ? `${base}${piso}` : "",
        addrLat: def?.lat ?? null,
        addrLng: def?.lng ?? null,
        addrExtra: descripcion || referencia || "",
      };
    }

    if (user.direccion) {
      return {
        addrLabel: user.direccion,
        addrLat: null,
        addrLng: null,
        addrExtra: user.direccionDescripcion || user.direccionReferencia || "",
      };
    }

    return {
      addrLabel: "",
      addrLat: null,
      addrLng: null,
      addrExtra: "",
    };
  }, [user]);

  const greeting = user ? `¡Hola, ${user.nombre || user.username}!` : "¡Hola!";

  const avatarLetter =
    user?.nombre?.charAt(0)?.toUpperCase() ||
    user?.username?.charAt(0)?.toUpperCase() ||
    "U";

  const hasUsableAddress =
    Boolean(addrLabel) && addrLat != null && addrLng != null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const refreshActiveOrder = () => {
      setHasActiveOrder(hasActiveOrderInStorage());
    };

    refreshActiveOrder();

    window.addEventListener("storage", refreshActiveOrder);
    window.addEventListener("focus", refreshActiveOrder);

    return () => {
      window.removeEventListener("storage", refreshActiveOrder);
      window.removeEventListener("focus", refreshActiveOrder);
    };
  }, []);

  const goAddresses = () => {
    setProfileOpen(false);
    navigate("/direcciones");
  };

  const goProfile = () => {
    setProfileOpen(false);
    navigate("/perfil");
  };

  const pickService = (type, surcharge) => {
    if (!addrLabel) {
      alert("Primero agregá una dirección principal para poder pedir un envío.");
      navigate("/direcciones");
      return;
    }

    if (!hasUsableAddress) {
      alert(
        "Tu dirección no tiene ubicación GPS confirmada. Actualizala para poder calcular el envío correctamente."
      );
      navigate("/direcciones");
      return;
    }

    setService(type, surcharge);

    setOrigin(addrLabel, {
      lat: addrLat,
      lng: addrLng,
    });

    navigate("/flow/enviar");
  };

  const handleLogout = async () => {
    setProfileOpen(false);

    try {
      if (typeof auth?.logout === "function") {
        await auth.logout();
      }

      if (typeof auth?.signOut === "function") {
        await auth.signOut();
      }

      if (typeof auth?.logoutUser === "function") {
        await auth.logoutUser();
      }
    } catch (error) {
      console.error("[HOME] Error al cerrar sesión:", error);
    }

    localStorage.removeItem("SessionUser");
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    navigate("/login", { replace: true });
  };

  const actions = [
    {
      key: "simple",
      title: "Simple",
      desc: "Llaves o papeles",
      tone: "neutral",
      image: "/imgs/services/simple.png",
      icon: simpleIcon,
      surcharge: 0,
      badge: "Rápido",
    },
    {
      key: "box",
      title: "Box",
      desc: "Hasta 10 kg",
      tone: "neutral",
      icon: boxIcon,
      surcharge: 0.07,
    },
    {
      key: "bigbox",
      title: "BigBox",
      desc: "Hasta 20 kg",
      tone: "neutral",
      icon: bigBoxIcon,
      surcharge: 0.12,
    },
    {
      key: "valores",
      title: "Valores",
      desc: "Dinero o frágiles",
      tone: "neutral",
      icon: valoresIcon,
      surcharge: 0.2,
      badge: "Seguro",
    },
    {
      key: "delivery",
      title: "Delivery",
      desc: "Comidas",
      tone: "neutral",
      icon: foodIcon,
      surcharge: 0.07,
      badge: "Promo",
    },
  ];

  return (
    <div className={styles.homeRoot}>
      <main className={styles.homeMain}>
        <section className={styles.topStage}>
          <div className={styles.topGlowOne} aria-hidden="true" />
          <div className={styles.topGlowTwo} aria-hidden="true" />

          <header className={styles.homeFloatingHeader}>
            <div className={styles.profileWrapper} ref={profileMenuRef}>
              <button
                type="button"
                className={styles.homeAvatar}
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-label="Abrir menú de perfil"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Usuario" />
                ) : (
                  <span>{avatarLetter}</span>
                )}
              </button>

              {profileOpen && (
                <div className={styles.profileMenu}>
                  <button type="button" onClick={goProfile}>
                    <span className={styles.profileMenuIcon}>{userIcon}</span>
                    <span>Mi perfil</span>
                  </button>

                  <button type="button" onClick={goAddresses}>
                    <span className={styles.profileMenuIcon}>{pinIcon}</span>
                    <span>Mis direcciones</span>
                  </button>

                  <button
                    type="button"
                    className={styles.logoutOption}
                    onClick={handleLogout}
                  >
                    <span className={styles.profileMenuIcon}>{logoutIcon}</span>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>

            <div className={styles.homeHeaderInfo}>
              <strong>{greeting}</strong>
              <span>
                {addrLabel
                  ? "Tu cadetería online está activa"
                  : "Agregá una dirección para comenzar"}
              </span>
            </div>

            <button
              type="button"
              className={styles.homeHeaderAction}
              onClick={goAddresses}
            >
              Mis direcciones
            </button>
          </header>
        </section>

        <section className={styles.homeContent}>
          <div className={styles.homeLayout}>
            <div className={styles.addrStickyWrap}>
              <button
                type="button"
                className={`${styles.addrBtn} ${
                  !hasUsableAddress ? styles.addrBtnWarning : ""
                }`}
                onClick={goAddresses}
                title="Dirección actual"
              >
                <span className={styles.addrIcon} aria-hidden="true">
                  {pinIcon}
                </span>

                <span className={styles.addrText}>
                  <strong>Dirección actual</strong>
                  <span>{addrLabel || "Elegí tu dirección principal"}</span>
                  {addrExtra && <em>{addrExtra}</em>}
                </span>

                <span className={styles.addrChevron} aria-hidden="true">
                  {chevIcon}
                </span>
              </button>
            </div>

            <section
              className={styles.servicesPanel}
              aria-label="Tipos de envío"
            >
              <div className={styles.servicesHeader}>
                <div>
                  <span className={styles.sectionKicker}>Servicios</span>
                  <h1>¿Qué necesitás enviar?</h1>
                  <p>Elegí el tipo de pedido para continuar.</p>
                </div>
              </div>

              <div className={styles.actionsGrid}>
                {actions.map((a) => (
                  <HomeActionCard
                    key={a.key}
                    icon={a.icon}
                    image={a.image}
                    title={a.title}
                    desc={a.desc}
                    tone={a.tone}
                    badge={a.badge}
                    onClick={() => pickService(a.key, a.surcharge)}
                  />
                ))}
              </div>
            </section>

            <section className={styles.carouselSection} aria-label="Novedades">
              <div className={styles.carouselHeader}>
                <span>Novedades</span>
                <strong>Opciones rápidas</strong>
              </div>

              <div className={styles.carouselTrack}>
                <article className={styles.carouselCard}>
                  <div>
                    <span>Rápido</span>
                    <h2>Enviá documentos o llaves</h2>
                    <p>Ideal para gestiones dentro de la ciudad.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => pickService("simple", 0)}
                  >
                    Enviar
                  </button>
                </article>

                <article className={styles.carouselCard}>
                  <div>
                    <span>Delivery</span>
                    <h2>Retiro de comidas</h2>
                    <p>Coordinamos con cadetes disponibles.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => pickService("delivery", 0.07)}
                  >
                    Pedir
                  </button>
                </article>

                <article className={styles.carouselCard}>
                  <div>
                    <span>Seguro</span>
                    <h2>Valores o delicados</h2>
                    <p>Para envíos que requieren más cuidado.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => pickService("valores", 0.2)}
                  >
                    Ver
                  </button>
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

      {hasActiveOrder && <ActiveOrderSheet />}

      <BottomNav />
    </div>
  );
}

const pinIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const chevIcon = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const simpleIcon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 8l9 6 9-6" />
  </svg>
);

const boxIcon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96L12 12l8.73-5.04" />
  </svg>
);

const bigBoxIcon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <path d="M2.5 10h19" />
  </svg>
);

const valoresIcon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8M12 8v8" />
  </svg>
);

const foodIcon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 3h16l-1 7H5L4 3z" />
    <path d="M7 16h10" />
    <circle cx="7" cy="19" r="2" />
    <circle cx="17" cy="19" r="2" />
  </svg>
);

const clockIcon = (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const userIcon = (
  <svg
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const logoutIcon = (
  <svg
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);