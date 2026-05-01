import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { Toaster } from 'react-hot-toast';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

document.title = import.meta.env.VITE_APP_NAME || 'Sistema de Beneficios';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
    </React.StrictMode>,
)

// Manual Service Worker Registration (Bulletproof)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(reg => console.log('[PWA] Service Worker Registered:', reg.scope))
            .catch(err => console.error('[PWA] Service Worker Registration Failed:', err));
    });
}
