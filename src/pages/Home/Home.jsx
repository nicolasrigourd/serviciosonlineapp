import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../../components/Navbar/Navbar";
import BottomNav from "../../components/BottomNav/BottomNav";
import { useFlow } from "../../state/FlowContext";
import { useAuth } from "../../state/AuthProvider";
import styles from "./Home.module.css";
import HomeActionCard from "../../components/HomeActionCard/HomeActionCard";

export default function Home() {
  const navigate = useNavigate();

  const { user: ctxUser } = useAuth();

  const cachedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("SessionUser") || "null");
    } catch {
      return null;
    }
  })();

  const user = ctxUser || cachedUser;

  const { addrLabel, addrLat, addrLng } = useMemo(() => {
    if (!user) return { addrLabel: "", addrLat: null, addrLng: null };

    if (Array.isArray(user.addresses) && user.addresses.length) {
      const def = user.addresses.find((a) => a?.isDefault) || user.addresses[0];

      const label = def?.address
        ? def.address + (def?.piso ? `, ${def.piso}` : "")
        : "";

      return {
        addrLabel: label,
        addrLat: def?.lat ?? null,
        addrLng: def?.lng ?? null,
      };
    }

    if (user.direccion) {
      return {
        addrLabel: user.direccion,
        addrLat: null,
        addrLng: null,
      };
    }

    return { addrLabel: "", addrLat: null, addrLng: null };
  }, [user]);

  const greeting = user ? `¡Hola, ${user.nombre || user.username}!` : "¡Hola!";

  const { setService, setOrigin } = useFlow();

  const pickService = (type, surcharge) => {
    setService(type, surcharge);

    setOrigin(
      addrLabel || "",
      addrLat != null && addrLng != null
        ? { lat: addrLat, lng: addrLng }
        : null
    );

    navigate("/flow/enviar");
  };

  const goAddresses = () => navigate("/direcciones");

  const actions = [
    {
      key: "simple",
      title: "Simple",
      desc: "Llaves o papeles",
      tone: "neutral",
      image: "/imgs/services/simple.png",
      icon: simpleIcon,
      surcharge: 0,
      badge: "Oferta",
    },
    {
      key: "box",
      title: "Box",
      desc: "Paquetes ≤ 10 kg",
      tone: "neutral",
      icon: boxIcon,
      surcharge: 0.07,
    },
    {
      key: "bigbox",
      title: "BigBox",
      desc: "Paquetes ≤ 20 kg",
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
    <div className={styles.screen}>
      <Navbar greeting={greeting} />

      <main className={styles.main}>
        <div className={styles.homeLayout}>
          <section className={styles.section}>
            <button
              type="button"
              className={styles.addrBtn}
              onClick={goAddresses}
              title="Dirección actual"
            >
              <span className={styles.addrIcon} aria-hidden="true">
                {pinIcon}
              </span>

              <span className={styles.addrText}>
                <strong>Dirección actual</strong>
                <span>{addrLabel || "Elegí tu dirección principal"}</span>
              </span>

              <span className={styles.addrChevron} aria-hidden="true">
                {chevIcon}
              </span>
            </button>
          </section>

          <section className={styles.section} aria-label="Mensaje principal">
            <div className={styles.hero}>
              <div className={styles.heroContent}>
                <span className={styles.heroKicker}>Cadetería online</span>
                <h2 className={styles.heroTitle}>Enviá lo que quieras</h2>
                <p className={styles.heroText}>
                  Pedí un cadete en minutos y seguí tu envío desde la app.
                </p>
              </div>

              <div className={styles.heroBadge}>
                <span className={styles.dot} aria-hidden="true" />
                {addrLabel ? "Activo en tu zona" : "Elegí una dirección"}
              </div>
            </div>
          </section>

          <section className={styles.servicesSection} aria-label="Tipos de envío">
            <div className={styles.servicesHeader}>
              <div>
                <h2 className={styles.servicesTitle}>Servicios</h2>
                <p className={styles.servicesText}>
                  Elegí qué necesitás enviar
                </p>
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

          <section className={styles.infoBanner} aria-label="Información">
            <div className={styles.infoIcon}>{clockIcon}</div>

            <div className={styles.infoText}>
              <strong>Envíos rápidos y seguros</strong>
              <span>Coordinamos tu pedido con repartidores disponibles.</span>
            </div>
          </section>
        </div>
      </main>

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