/*
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../../components/Navbar/Navbar";
import BottomNav from "../../components/BottomNav/BottomNav";
import { useFlow } from "../../state/FlowContext";
import styles from "./Home.module.css";
import HomeActionCard from "../../components/HomeActionCard/HomeActionCard";

export default function Home() {
  const [user, setUser] = useState(null);
  const [addr, setAddr] = useState("Mitre 535, G4200 Santiago del Estero, Argentina");
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(0);

  const navigate = useNavigate();

  // 👇 usamos las nuevas acciones del context
  const { setService, setOrigin } = useFlow();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("SessionUser");
      if (raw) {
        const u = JSON.parse(raw);
        setUser(u);
        if (u?.direccion) setAddr(u.direccion);
      }
    } catch {}
  }, []);

  const greeting = user ? `¡Hola, ${user.nombre || user.username}!` : "¡Hola!";

  const onScrollCarousel = () => {
    const el = trackRef.current;
    if (!el) return;
    const slideW = el.clientWidth;
    const i = Math.round(el.scrollLeft / slideW);
    setIdx(i);
  };

  const slides = [
    { id: 1, src: "/imgs/envio-1.jpg", alt: "Mensajería urbana" },
    { id: 2, src: "/imgs/envio-2.jpg", alt: "Paquetes express" },
    { id: 3, src: "/imgs/envio-3.jpg", alt: "Envíos programados" },
  ];

  // 👇 handler centralizado para todos los tipos de envío
  const pickService = (type, surcharge) => {
    // 1) Guardar tipo de trámite
    setService(type, surcharge);
    // 2) Guardar la dirección actual como origen
    setOrigin(addr, null); // coords null por ahora
    // 3) Ir a la page Enviar
    navigate("/flow/enviar");
  };

  // 👇 NUEVO: ir a Mis direcciones al tocar la barra de dirección
  const goAddresses = () => navigate("/direcciones");

  // 👇 Lista de acciones para renderizar con HomeActionCard
  const actions = [
    { key: "simple",   title: "Simple",   desc: "Llaves o papeles",   tone: "blue",   icon: simpleIcon,   surcharge: 0 },
    { key: "box",      title: "Box",      desc: "Paquetes ≤ 10 kg",   tone: "green",  icon: boxIcon,      surcharge: 0.07 },
    { key: "bigbox",   title: "BigBox",   desc: "Paquetes ≤ 20 kg",   tone: "orange", icon: bigBoxIcon,   surcharge: 0.12 },
    { key: "valores",  title: "Valores",  desc: "Dinero o frágiles",  tone: "purple", icon: valoresIcon,  surcharge: 0.2 },
    { key: "delivery", title: "Delivery", desc: "Envío de comidas",   tone: "yellow", icon: foodIcon,     surcharge: 0.07 },
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
              <span className={styles.addrIcon} aria-hidden="true">{pinIcon}</span>
              <span className={styles.addrText}>
                <strong>Dirección actual:</strong> {addr}
              </span>
              <span className={styles.addrChevron} aria-hidden="true">{chevIcon}</span>
            </button>
          </section>

         
          <section className={styles.section} aria-label="Mensaje de bienvenida">
            <div className={styles.hero}>
              <div className={styles.heroContent}>
                <h2 className={styles.heroTitle}>¿Qué necesitás hoy?</h2>
                <p className={styles.heroText}>Cotizá y pedí en minutos.</p>
              </div>
              <div className={styles.heroBadge}>
                <span className={styles.dot} aria-hidden="true"></span>
                Activo en tu zona
              </div>
            </div>
          </section>

         
          <section className={styles.section} aria-label="Promos y novedades">
            <div className={styles.carousel}>
              <div ref={trackRef} className={styles.track} onScroll={onScrollCarousel}>
                {slides.map((s) => (
                  <div key={s.id} className={styles.slide}>
                    <img className={styles.slideImg} src={s.src} alt={s.alt} />
                  </div>
                ))}
              </div>
              <div className={styles.dots}>
                {slides.map((s, i) => (
                  <span
                    key={s.id}
                    className={`${styles.dotI} ${i === idx ? styles.dotActive : ""}`}
                  />
                ))}
              </div>
            </div>
          </section>

          
          <section className={styles.actionsSection} aria-label="Tipos de envío">
            <div className={styles.actionsFrame}>
              <div className={styles.actionsGrid}>
                {actions.map(a => (
                  <HomeActionCard
                    key={a.key}
                    icon={a.icon}
                    title={a.title}
                    desc={a.desc}
                    tone={a.tone}
                    onClick={() => pickService(a.key, a.surcharge)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}


const pinIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const chevIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
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

const bigBoxIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <path d="M2.5 10h19" />
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
*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../../components/Navbar/Navbar";
import BottomNav from "../../components/BottomNav/BottomNav";
import { useFlow } from "../../state/FlowContext";
import { useAuth } from "../../state/AuthProvider";
import styles from "./Home.module.css";
import HomeActionCard from "../../components/HomeActionCard/HomeActionCard";

export default function Home() {
  const navigate = useNavigate();
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(0);

  // 👉 ahora leemos del AuthProvider (y no hardcodeamos dirección)
  const { user: ctxUser } = useAuth();

  // Fallback suave si por timing no llegó el contexto aún
  const cachedUser = (() => {
    try { return JSON.parse(localStorage.getItem("SessionUser") || "null"); } catch { return null; }
  })();
  const user = ctxUser || cachedUser;

  // Derivamos dirección principal y coords desde el usuario
  const { addrLabel, addrLat, addrLng } = useMemo(() => {
    if (!user) return { addrLabel: "", addrLat: null, addrLng: null };

    // 1) addresses[].isDefault
    if (Array.isArray(user.addresses) && user.addresses.length) {
      const def = user.addresses.find(a => a?.isDefault) || user.addresses[0];
      const label = def?.address ? def.address + (def?.piso ? `, ${def.piso}` : "") : "";
      return { addrLabel: label, addrLat: def?.lat ?? null, addrLng: def?.lng ?? null };
    }

    // 2) compat: direccion (+ no tenemos lat/lng en este caso)
    if (user.direccion) return { addrLabel: user.direccion, addrLat: null, addrLng: null };

    return { addrLabel: "", addrLat: null, addrLng: null };
  }, [user]);

  const greeting = user ? `¡Hola, ${user.nombre || user.username}!` : "¡Hola!";

  const onScrollCarousel = () => {
    const el = trackRef.current;
    if (!el) return;
    const slideW = el.clientWidth;           // ancho del viewport del carrusel
    const i = Math.round(el.scrollLeft / slideW);
    setIdx(i);
  };

  const slides = [
    { id: 1, src: "/imgs/envio-1.jpg", alt: "Mensajería urbana" },
    { id: 2, src: "/imgs/envio-2.jpg", alt: "Paquetes express" },
    { id: 3, src: "/imgs/envio-3.jpg", alt: "Envíos programados" },
  ];

  // Context de tu flujo
  const { setService, setOrigin } = useFlow();

  // Handler centralizado para todos los tipos de envío
  const pickService = (type, surcharge) => {
    // 1) Tipo de trámite
    setService(type, surcharge);
    // 2) Origen con label + coords si están disponibles
    setOrigin(addrLabel || "", (addrLat != null && addrLng != null) ? { lat: addrLat, lng: addrLng } : null);
    // 3) Ir al flujo
    navigate("/flow/enviar");
  };

  // Ir a Mis direcciones al tocar la barra de dirección
  const goAddresses = () => navigate("/direcciones");

  const actions = [
    { key: "simple",   title: "Simple",   desc: "Llaves o papeles",   tone: "blue",   icon: simpleIcon,   surcharge: 0 },
    { key: "box",      title: "Box",      desc: "Paquetes ≤ 10 kg",   tone: "green",  icon: boxIcon,      surcharge: 0.07 },
    { key: "bigbox",   title: "BigBox",   desc: "Paquetes ≤ 20 kg",   tone: "orange", icon: bigBoxIcon,   surcharge: 0.12 },
    { key: "valores",  title: "Valores",  desc: "Dinero o frágiles",  tone: "purple", icon: valoresIcon,  surcharge: 0.2 },
    { key: "delivery", title: "Delivery", desc: "Envío de comidas",   tone: "yellow", icon: foodIcon,     surcharge: 0.07 },
  ];

  return (
    <div className={styles.screen}>
      <Navbar greeting={greeting} />

      <main className={styles.main}>
        <div className={styles.homeLayout}>
          {/* 1) Dirección actual */}
          <section className={styles.section}>
            <button
              type="button"
              className={styles.addrBtn}
              onClick={goAddresses}
              title="Dirección actual"
            >
              <span className={styles.addrIcon} aria-hidden="true">{pinIcon}</span>
              <span className={styles.addrText}>
                <strong>Dirección actual:</strong>{" "}
                {addrLabel || "Elegí tu dirección principal"}
              </span>
              <span className={styles.addrChevron} aria-hidden="true">{chevIcon}</span>
            </button>
          </section>

          {/* 2) Banner */}
          <section className={styles.section} aria-label="Mensaje de bienvenida">
            <div className={styles.hero}>
              <div className={styles.heroContent}>
                <h2 className={styles.heroTitle}>¿Qué necesitás hoy?</h2>
                <p className={styles.heroText}>Cotizá y pedí en minutos.</p>
              </div>
              <div className={styles.heroBadge}>
                <span className={styles.dot} aria-hidden="true"></span>
                {addrLabel ? "Activo en tu zona" : "Elegí una dirección"}
              </div>
            </div>
          </section>

          {/* 3) Carrusel */}
          <section className={styles.section} aria-label="Promos y novedades">
            <div className={styles.carousel}>
              <div ref={trackRef} className={styles.track} onScroll={onScrollCarousel}>
                {slides.map((s) => (
                  <div key={s.id} className={styles.slide}>
                    <img className={styles.slideImg} src={s.src} alt={s.alt} />
                  </div>
                ))}
              </div>
              <div className={styles.dots}>
                {slides.map((s, i) => (
                  <span
                    key={s.id}
                    className={`${styles.dotI} ${i === idx ? styles.dotActive : ""}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* 4) Cards de acciones */}
          <section className={styles.actionsSection} aria-label="Tipos de envío">
            <div className={styles.actionsFrame}>
              <div className={styles.actionsGrid}>
                {actions.map(a => (
                  <HomeActionCard
                    key={a.key}
                    icon={a.icon}
                    title={a.title}
                    desc={a.desc}
                    tone={a.tone}
                    onClick={() => pickService(a.key, a.surcharge)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

/* === Iconos inline (igual que los tuyos) === */
const pinIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const chevIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
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

const bigBoxIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <path d="M2.5 10h19" />
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
