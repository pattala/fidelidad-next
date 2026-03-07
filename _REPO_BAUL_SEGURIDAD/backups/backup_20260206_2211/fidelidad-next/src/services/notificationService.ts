import { collection } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const PUSH_API_URL = '/api/send-push'; // Next.js rewrites should handle this to server-api

export interface NotificationPayload {
    title: string;
    body: string;
    type?: string;
    templateId?: string;
    link?: string;
    icon?: string; // Added for branding
}

export const NotificationService = {
    /**
     * Sends a Push Notification to a client.
     * 1. Writes to Firestore Inbox (Persistent history in PWA).
     * 2. Calls Backend API to trigger real FCM Push (Device buzz).
     * Sends a notification to a specific client.
     * 1. Tries to send a Push Notification via Backend (if configured).
     * 2. Always saves to the Firestore Inbox.
     */
    async sendToClient(clientId: string, payload: NotificationPayload) {
        try {
            console.log(`[NotificationService] Sending to ${clientId}`, payload);

            // 1. Obtener Token del usuario para la API
            const user = auth.currentUser;
            if (!user) return;
            const idToken = await user.getIdToken();

            // 2. Llamar a la API de Vercel
            // Usamos /api/send-notification que ahora está configurada para Windows
            const response = await fetch('/api/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                    'x-api-key': import.meta.env.VITE_API_KEY || ''
                },
                body: JSON.stringify({
                    clienteId: clientId,
                    title: payload.title,
                    body: payload.body,
                    click_action: payload.link || '/inbox',
                    extraData: {
                        type: payload.type || 'system',
                        url: payload.link || '/inbox'
                    },
                    icon: payload.icon
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                console.error('[NotificationService] API Error:', errData);
            }

            // NOTA: No hacemos addDoc aquí porque /api/send-notification 
            // ya lo guarda en el 'inbox' automáticamente.

        } catch (error) {
            console.error('[NotificationService] Error in sendToClient:', error);
            throw error;
        }
    },

    /**
     * Helper to check if a channel is enabled for a specific event
     */
    isChannelEnabled(config: any, event: string, channel: 'whatsapp' | 'email' | 'push'): boolean {
        // 0. Master Kill Switches (Global Rules)
        // If the channel is globally disabled, NO event can use it.
        if (channel === 'whatsapp' && !config?.messaging?.whatsappEnabled) return false;
        if (channel === 'email' && !config?.messaging?.emailEnabled) return false;
        if (channel === 'push' && !config?.messaging?.pushEnabled) return false;

        // 1. Check specific granular config (Event Rules)
        const specific = config?.messaging?.eventConfigs?.[event]?.channels;
        if (specific && Array.isArray(specific)) {
            return specific.includes(channel);
        }

        // 2. Fallback Default
        // If no granular rule exists, and we passed the Global Switch check, allow it.
        return true;
    }
};
