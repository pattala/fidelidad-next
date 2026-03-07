import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

            // 1. Call Backend API for Real Push (FCM)
            // We wrap this in a silent try/catch so failure to PUSH doesn't stop Inbox save.
            try {
                await fetch(PUSH_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        templateId: payload.templateId || 'system_manual_push', // Use provided templateId or a default
                        segment: { type: 'one', uid: clientId },
                        overrideVars: {
                            titulo: payload.title,
                            cuerpo: payload.body
                        },
                        options: {
                            saveInbox: false, // Inbox is saved separately by this service
                            icon: payload.icon // Send logo to backend
                        }
                    })
                });
            } catch (err) {
                console.warn('[NotificationService] Backend push failed (silent)', err);
            }

            // 2. Save to Inbox (Firestore)
            if (clientId) {
                await addDoc(collection(db, `users/${clientId}/inbox`), {
                    title: payload.title,
                    body: payload.body,
                    date: new Date(),
                    type: payload.type || 'system',
                    read: false
                });
            }

        } catch (error) {
            console.error('[NotificationService] Error in sendToClient:', error);
            throw error; // Propagate to caller if main logic fails
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
