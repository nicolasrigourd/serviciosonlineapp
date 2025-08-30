import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../state/AuthProvider";

/**
 * Bloquea acceso a rutas de invitados (login, register) si ya hay sesión.
 * Redirige a /home (o a donde le pases via prop redirectTo).
 */
export default function GuestOnlyRoute({ children, redirectTo = "/home", loadingFallback = null }) {
  const { user, loading } = useAuth();
  if (loading) return loadingFallback;
  if (user) return <Navigate to={redirectTo} replace />;
  return children;
}
