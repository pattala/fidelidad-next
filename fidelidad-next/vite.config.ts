import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Cargar variables de entorno estáticas para el proceso de compilación (Node.js)
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            react(),
            VitePWA({
                strategies: 'injectManifest',
                srcDir: 'src',
                filename: 'sw.ts',
                registerType: 'autoUpdate',
                injectRegister: 'auto',
                manifest: {
                    name: env.VITE_APP_NAME || 'App de Beneficios',
                    short_name: env.VITE_APP_SHORT_NAME || 'Beneficios',
                    description: 'Tu aplicación de puntos y beneficios',
                    theme_color: '#ffffff',
                    background_color: '#ffffff',
                    display: 'standalone',
                    scope: '/',
                    start_url: '/',
                    orientation: 'portrait',
                    icons: [
                        {
                            src: 'pwa-192x192.png',
                            sizes: '192x192',
                            type: 'image/png'
                        },
                        {
                            src: 'pwa-512x512.png',
                            sizes: '512x512',
                            type: 'image/png'
                        },
                        {
                            src: 'pwa-512x512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any maskable'
                        }
                    ]
                }
            })
        ],
        server: {
            port: 5173,
            host: true
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            if (id.includes('firebase')) return 'vendor-firebase';
                            if (id.includes('recharts')) return 'vendor-charts';
                            if (id.includes('framer-motion')) return 'vendor-motion';
                            if (id.includes('lucide-react')) return 'vendor-icons';
                            if (id.includes('@headlessui/react')) return 'vendor-ui';
                        }
                    }
                }
            },
            chunkSizeWarningLimit: 1000,
        }
    };
})
