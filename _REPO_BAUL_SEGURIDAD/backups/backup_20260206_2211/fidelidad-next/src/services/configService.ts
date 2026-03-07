import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AppConfig } from '../types';

export type { AppConfig };

const CONFIG_DOC_PATH = 'config/general';

// Default Init Config
export const DEFAULT_APP_CONFIG: AppConfig = {
    siteName: 'Club de Fidelidad',
    primaryColor: '#2563eb',
    secondaryColor: '#1e3a8a',
    backgroundColor: '#f9fafb',
    logoUrl: '',
    contact: {
        whatsapp: '',
        email: '',
        instagram: '',
        facebook: '',
        website: '',
        termsAndConditions: ''
    },
    pointsPerPeso: 1,
    pointsMoneyBase: 100,
    pointValue: 10,
    welcomePoints: 100,
    enableWelcomeBonus: true,
    birthdayPoints: 100,
    enableBirthdayBonus: true,
    expirationRules: [],
    messaging: {
        emailEnabled: true,
        whatsappEnabled: false,
        pushEnabled: true,
        eventConfigs: {
            welcome: { channels: ['email', 'push', 'whatsapp'] },
            pointsAdded: { channels: ['push'] },
            redemption: { channels: ['email'] },
            campaign: { channels: ['push'] },
            offer: { channels: ['push'] },
            birthday: { channels: ['push', 'whatsapp'] }
        }
    },
};

export const ConfigService = {
    async get() {
        try {
            const ref = doc(db, CONFIG_DOC_PATH);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data() as Partial<AppConfig>;
                // Deep merge defaults (simple version)
                return {
                    ...DEFAULT_APP_CONFIG,
                    ...data,
                    messaging: {
                        ...DEFAULT_APP_CONFIG.messaging,
                        ...(data.messaging || {}),
                        eventConfigs: {
                            ...DEFAULT_APP_CONFIG.messaging?.eventConfigs,
                            ...(data.messaging?.eventConfigs || {})
                        }
                    }
                } as AppConfig;
            }
            return DEFAULT_APP_CONFIG;
        } catch (error) {
            console.error('Error loading config:', error);
            return DEFAULT_APP_CONFIG;
        }
    },

    async save(config: AppConfig) {
        try {
            const ref = doc(db, CONFIG_DOC_PATH);
            await setDoc(ref, config, { merge: true });
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }
};

export const DEFAULT_TEMPLATES = {
    whatsappDefaultMessage: "Hola {nombre}, ¡gracias por tu visita! Tenés {puntos} puntos disponibles. 📲",
    pointsAdded: "¡Hola {nombre}! 🎉 Sumaste {puntos} puntos. Tu nuevo saldo es {saldo} 🚀",
    redemption: "¡Felicidades {nombre}! 🎁 Canjeaste {premio}. Código: {codigo}. ¡Que lo disfrutes! ✨",
    welcome: "¡Bienvenido al Club, {nombre}! 👋 Ya tienes {puntos} puntos de regalo. 🎁",
    campaign: "🚀 ¡Nueva Campaña!: {titulo}. {descripcion}. ¡No te la pierdas! 🔥",
    offer: "🔥 ¡Oferta Especial! {titulo}: {detalle}. Válido hasta el {vencimiento}. 📢",
    birthday: "¡Feliz cumpleaños, {nombre}! 🎂🎉 Te regalamos {puntos} puntos para que los disfrutes. ¡Que pases un gran día! ✨"
};
