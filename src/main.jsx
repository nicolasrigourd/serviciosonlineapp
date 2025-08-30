import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'   // 👈 acá
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
