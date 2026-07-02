# Contexto del Proyecto — App Cliente (Zeus Engine)

> Archivo generado para iniciar una nueva sesión de desarrollo con contexto completo.
> Fecha: 2026-06-30

---

## 1. El Ecosistema — Zeus Engine

Sistema completo de cadetería/delivery para un negocio en Santiago del Estero, Argentina. Proyecto Firebase (`webappcadeteria`). Compuesto por **5 apps**:

| App | Ruta | Estado | Descripción |
|---|---|---|---|
| **Cliente** | `C:\PWA-cadeteria\Cliente` | ~70% | App del cliente final — pide, rastrea, paga |
| **Repartidor** | `C:\PWA-cadeteria\Repartidor` | ~85% | App del driver — recibe ofertas, navega, cierra pedidos |
| **Admin** | (separado) | Avanzado | Panel de gestión de repartidores, pedidos, finanzas |
| **Sucursal** | (separado) | Parcial | App para sucursales que generan pedidos propios |
| **Cadev2** | `C:\Cadev2` | Activo | Backend — Cloud Functions, matching engine, Firebase RTDB + Firestore |

### Cómo fluye un pedido en el ecosistema

```
Cliente crea pedido (Firestore: orders/{id})
       ↓
Cadev2 (Cloud Function) detecta el pedido nuevo
       ↓
Matching engine busca repartidor disponible → envía oferta
       ↓
App Repartidor muestra la oferta → driver acepta
       ↓
Cadev2 asigna el pedido → actualiza Firestore
       ↓
Cliente ve tracking en tiempo real (onSnapshot)
       ↓
Driver completa pasos → pedido cerrado
       ↓
Admin ve todo, gestiona finanzas / incidencias
```

### Firebase — Source of truth

- **Firestore** — pedidos (`orders`), repartidores (`repartidores`), usuarios cliente (`userswebapp`), usernames (`usernames`)
- **RTDB** — posición GPS en tiempo real de los repartidores (`driversLive/{cadeteId}`)
- **Auth** — anónimo en Repartidor, email/password en Cliente

---

## 2. Visión de la App Cliente — "Uber para cadetería"

La app cliente es **la cara del negocio hacia el usuario final**. La analogía correcta es Uber o PedidosYa desde el lado del cliente: el usuario pide un servicio, ve quién viene, lo rastrea en el mapa, paga, y califica.

### Tipos de servicio que ofrece el negocio

- **Simple** — envío de un paquete de punto A a punto B
- **Retiro** — el cadete va a retirar algo (de un local, oficina, etc.)
- **Box** — envío de caja/bulto más grande
- **Valores** — documentos o elementos de valor
- **Delivery** — pedido de comida/productos desde un comercio (futuro)

### Qué debe sentir el usuario al usar la app

1. Abre la app → ve los servicios disponibles de forma clara
2. Elige un servicio → en 3-4 pasos define origen, destino, contactos y pago
3. Confirma el pedido → ve en pantalla que "Zeus está buscando un cadete"
4. Un cadete acepta → ve el nombre, la distancia, un mapa con su posición
5. El cadete se mueve → el mapa se actualiza en tiempo real (como Uber)
6. Entrega realizada → puede calificar, ver el comprobante, repetir el pedido
7. Historial siempre accesible → todos sus pedidos con detalle

---

## 3. Stack Tecnológico Actual

```
React 19.1.1 + Vite 7.1.2
React Router v7.8.1
Firebase (Auth email/password + Firestore)
Google Maps API (Autocomplete, Directions, Geocoding)
React Hook Form v7.62.0 + Zod v4.0.17 (validaciones)
Tabler Icons (iconografía)
CSS Modules (estilos)
```

**Sin Capacitor** — actualmente es PWA web pura, sin APK nativa. A futuro se puede evaluar si se empaqueta con Capacitor igual que la App Repartidor.

---

## 4. Estructura de Carpetas

```
src/
├── pages/           # Pantallas principales
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Home.jsx
│   ├── Enviar.jsx       # Flujo: seleccionar origen/destino
│   ├── Retirar.jsx      # Flujo: seleccionar punto de retiro
│   ├── DatosAdicionales.jsx  # Contactos, notas, método de pago
│   ├── Checkout.jsx     # Resumen + tracking en tiempo real
│   ├── MisPedidos.jsx   # Historial
│   ├── MisDirecciones.jsx
│   └── Profile.jsx
├── components/
│   ├── BottomNav.jsx
│   ├── HomeActionCard.jsx
│   ├── PedidoCard.jsx
│   ├── TrackingPedido.jsx   # Muestra pasos del repartidor
│   ├── ActiveOrderSheet.jsx # Sheet flotante con pedido activo
│   ├── AdressMapPicker.jsx  # Selector mapa con autocomplete
│   ├── CardDirecciones.jsx
│   ├── FlowHeader.jsx
│   ├── LoadingScreen.jsx
│   └── Modal.jsx
├── services/
│   ├── firebase.js          # Init Firebase + funciones auth
│   └── addressesService.js  # CRUD de direcciones (runTransaction)
├── state/
│   ├── AuthProvider.jsx     # Context: usuario logueado
│   └── FlowContext.jsx      # Context: estado del flujo de pedido
├── routes/
│   └── AppRouter.jsx
└── lib/
    └── (utilitarios Maps, persistencia)
```

---

## 5. Colecciones Firestore que usa el Cliente

### `userswebapp/{uid}`
```js
{
  nombre, apellido, email, username, telefono, dpto,
  userNumber,         // número interno único
  createdAt, updatedAt,
  addresses: [        // array de direcciones guardadas
    {
      id, label,
      address,        // string formateado
      lat, lng,
      piso, descripcion, referencia,
      isDefault
    }
  ]
}
```

### `usernames/{username}`
```js
{ uid }  // mapeo username → uid para verificar disponibilidad
```

### `orders/{orderId}` — compartida con Repartidor y Cadev2
```js
{
  status,             // pending | assigned | completed | cancelled | ...
  clientId,           // uid del cliente
  pickup: {           // punto de retiro
    address, lat, lng,
    contact: { name, phone },
    notes, floor
  },
  dropoff: {          // punto de entrega
    address, lat, lng,
    contact: { name, phone },
    notes, floor
  },
  payment: {
    method,           // cash | digital
    provider,         // mercadopago | etc
    amount
  },
  assignment: {       // llenado por Cadev2 al asignar
    driverId, driverName,
    assignedAt
  },
  delivery: {         // pasos del repartidor
    currentStep,      // go_to_pickup | arrived_pickup | go_to_origin | ...
    steps: []
  },
  km, price,
  service,            // tipo de servicio
  createdAt
}
```

---

## 6. Estado Actual — Lo que Funciona

✅ **Autenticación completa** — login por username o email, registro con validaciones Zod, persistencia en localStorage  
✅ **Flujo de pedido básico** — Envío y Retiro: mapa picker, cálculo de distancia/precio, datos de contacto  
✅ **Tracking en tiempo real** — `onSnapshot` en Checkout, muestra 6 pasos del repartidor correctamente  
✅ **Historial de pedidos** — tabs por estado, acciones (ver, cancelar, repetir, eliminar)  
✅ **Gestión de direcciones** — CRUD con Google Maps, múltiples con default  
✅ **Perfil** — editar datos, cambio de contraseña  
✅ **Método de pago efectivo** — flujo completo hasta checkout  

---

## 7. Bugs Conocidos

| Archivo | Línea | Bug | Impacto |
|---|---|---|---|
| `src/services/firebase.js` | ~13 | `appId:import.meta.env` sin espacio ni variable completa | Puede romper init en producción |
| Varios | - | Múltiples `alert()` hardcodeados como placeholders | UX horrible en móvil |

---

## 8. Lo que Está Pendiente / Incompleto

### Crítico para producción

- **MercadoPago real** — existe selección del método pero no hay integración real (no redirige, no maneja webhooks, no confirma pago)
- **Recuperación de contraseña** — `alert("Luego conectamos el flujo...")` literal en Login
- **Notificaciones push** — sin Firebase Messaging, el cliente no sabe si le asignaron cadete

### Importante para la experiencia

- **Mapa con repartidor en tiempo real** — TrackingPedido muestra pasos de texto pero NO muestra el mapa con el pin del repartidor moviéndose (lo que tiene Uber). Los datos GPS están en RTDB (`driversLive/{driverId}`) pero el cliente no los lee
- **Calificación del repartidor** — no existe ningún flujo de rating post-entrega
- **Detalle de pedidos históricos** — `alert("Detalle pendiente")` en MisPedidos
- **Precio real** — usa `km × 1000` hardcodeado, debería venir de tabla de tarifas del Admin

### Agradable tener

- **Offline support** — sin Service Worker propio, sin sync offline
- **Tipo "Delivery" diferenciado** — el botón existe en Home pero hace lo mismo que Envío

---

## 9. Roadmap de Desarrollo Sugerido

### Fase 1 — Fixes urgentes (antes de cualquier usuario real)
1. Corregir bug en `firebase.js`
2. Reemplazar todos los `alert()` por modales/toasts
3. Implementar recuperación de contraseña (Firebase `sendPasswordResetEmail`)
4. Precio real desde Firestore (tabla de tarifas que administre el Admin)

### Fase 2 — La experiencia Uber
5. **Mapa en vivo con el repartidor** — conectar RTDB `driversLive/{driverId}` al Checkout, mostrar pin moviéndose en Google Maps
6. **Notificaciones push** — Firebase Messaging: "Tu cadete está en camino", "Tu pedido fue entregado"
7. **Calificación post-entrega** — pantalla de rating tras cierre del pedido, escribe en `orders/{id}` y en `repartidores/{id}`

### Fase 3 — Completar features
8. MercadoPago real — SDK, preferencias, webhooks, confirmación
9. Detalle de pedidos históricos
10. Tipo "Delivery" con flujo diferenciado (comercio → cliente)

### Fase 4 — Pulido y escala
11. Offline support / cache inteligente
12. Capacitor → APK si se decide ir a Play Store
13. Rediseño visual completo (hoy el diseño es funcional pero no tiene la identidad visual del resto del ecosistema)

---

## 10. Contexto de la App Repartidor (para alinear desarrollo)

La App Repartidor (`C:\PWA-cadeteria\Repartidor`) ya tiene:

- Sistema de niveles, racha, valoraciones positivas/negativas
- Tracking GPS por distancia (escribe en RTDB `driversLive/{cadeteId}`)
- Flujo de pedido activo con pasos: go_to_pickup → arrived_pickup → go_to_origin → arrived_origin → go_to_dropoff → arrived_dropoff
- Sistema de batería (bloqueo si ≤20%)
- Detección de conectividad en tiempo real
- Modales pre-conexión (red, cuenta bloqueada, batería, deuda)
- Botón back nativo Android con comportamiento correcto

Los campos que escribe el repartidor en `orders/{id}` son exactamente los que el cliente debe leer para el tracking. La fuente de la posición GPS en tiempo real es `rtdb/driversLive/{driverId}`.

---

## 11. Decisiones de Diseño y Preferencias del Proyecto

- **Idioma del schema Firestore**: inglés (migración en curso desde español legacy)
- **Dark mode**: la App Repartidor usa dark theme completo. El Cliente hoy usa diseño claro — decisión a tomar si se unifica o se mantiene diferenciado
- **Sin gradientes**: preferencia explícita del dueño — colores sólidos, íconos sobrios
- **Estilo Phosphor Icons** en App Repartidor (ya instalado). El Cliente usa Tabler Icons — se puede unificar
- **CSS variables para tokens de diseño** — ya definidos en App Repartidor (`--bg`, `--surface`, `--surface-2`, `--border`, `--text-1/2/3`, `--accent`)
- **Dinámica de trabajo**: discutir y acordar enfoque antes de tocar código o infra. No implementar features no acordadas
