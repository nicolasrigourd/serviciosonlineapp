// src/components/LoadingScreen.jsx
import React from "react";

export default function LoadingScreen({ label = "Cargando…" }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0b0c10",
      color: "white"
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span
          style={{
            width: 18, height: 18, borderRadius: "50%",
            border: "3px solid rgba(255,255,255,.25)",
            borderTopColor: "white",
            animation: "spin 0.9s linear infinite"
          }}
        />
        <span style={{ fontSize: 16, opacity: 0.9 }}>{label}</span>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
