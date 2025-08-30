// src/App.jsx
import React from "react";
import AppRouter from "./routes/AppRouter";
import { FlowProvider } from "./state/FlowContext";
import { AuthProvider } from "./state/AuthProvider"; // 👈 importá el nuevo provider
import "./styles/globals.css";

export default function App() {
  return (
    <AuthProvider>
      <FlowProvider>
        <AppRouter />
      </FlowProvider>
    </AuthProvider>
  );
}
