import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthProvider";

/**
 * Protege rutas que requieren sesión.
 * - Mientras carga el estado inicial, muestra un placeholder (o null).
 * - Si no hay user, redirige a /login y guarda la ruta original en state.from.
 */
export default function ProtectedRoute({ children, loadingFallback = null }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return loadingFallback; // podés pasar un spinner propio

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
