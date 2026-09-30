import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const Admin = lazy(() => import('./admin/Admin.tsx'))
const ehAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {ehAdmin ? (
      <Suspense>
        <Admin />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
