import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { Toaster } from 'react-hot-toast';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

import { APP_VERSION } from './lib/adminConfig';

document.title = import.meta.env.VITE_APP_NAME || 'Sistema de Beneficios';
console.log(`%c 💎 RAMPET DASHBOARD ${APP_VERSION} `, 'background: #7c3aed; color: #fff; font-weight: bold; padding: 4px; border-radius: 4px;');


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
