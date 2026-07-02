// src/routes/AppRouter.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "../pages/Login/Login";
import Home from "../pages/Home/Home";
import Enviar from "../pages/Enviar/Enviar";
import Retirar from "../pages/Retirar/Retirar";
import Register from "../pages/Register/Register";
import DatosAdicionales from "../pages/DatosAdicionales/DatosAdicionales";
import Checkout from "../pages/Checkout/Checkout";
import FlowEnvio from "../pages/FlowEnvio/FlowEnvio";
import FlowRetiro from "../pages/FlowRetiro/FlowRetiro";
import FlowDelivery from "../pages/FlowDelivery/FlowDelivery";
import FlowCompras from "../pages/FlowCompras/FlowCompras";
import FlowValores from "../pages/FlowValores/FlowValores";
import MisPedidos from "../pages/MisPedidos/MisPedidos";
import MisDirecciones from "../pages/MisDirecciones/MisDirecciones";
import Profile from "../pages/Profile/Profile";

import ProtectedRoute from "./ProtectedRoute";
import GuestOnlyRoute from "./GuestOnlyRoute";
import LoadingScreen from "../components/LoadingScreen";

export default function AppRouter() {
  const loader = <LoadingScreen label="Preparando tu sesión…" />;

  return (
    <Router>
      <Routes>
        {/* Invitados */}
        <Route
          path="/login"
          element={
            <GuestOnlyRoute loadingFallback={loader}>
              <Login />
            </GuestOnlyRoute>
          }
        />

        <Route
          path="/register"
          element={
            <GuestOnlyRoute loadingFallback={loader}>
              <Register />
            </GuestOnlyRoute>
          }
        />

        {/* Protegidas */}
        <Route
          path="/home"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/envio"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <FlowEnvio />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/retiro"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <FlowRetiro />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/delivery"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <FlowDelivery />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/compras"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <FlowCompras />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/valores"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <FlowValores />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/enviar"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <Enviar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/retirar"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <Retirar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/datos"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <DatosAdicionales />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow/checkout"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <Checkout />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <MisPedidos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/direcciones"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <MisDirecciones />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route
          path="*"
          element={
            <ProtectedRoute loadingFallback={loader}>
              <Home />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}