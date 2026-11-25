import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import './index.css'
import App from './App.tsx'
import { PullToRefresh } from './ui/components/PullToRefresh'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PullToRefresh />
  </StrictMode>,
)
