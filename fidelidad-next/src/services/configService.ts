import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AppConfig } from '../types';
import { AuditService } from './auditService';

export type { AppConfig };

const CONFIG_DOC_PATH = 'config/general';

// Default Init Config
export const DEFAULT_APP_CONFIG: AppConfig = {
    siteName: '',
    primaryColor: '#2563eb',
    secondaryColor: '#1e3a8a',
    backgroundColor: '#f9fafb',
    logoUrl: '',
    logoSize: 32,
    siteNameFont: 'Inter',
    siteNameSize: 14,
    siteNameAlignment: 'center',
    carouselSpeedSeconds: 6,
    contact: {
        whatsapp: '',
        email: '',
        instagram: '',
        facebook: '',
        website: '',
        termsAndConditions: '',
        termsContent: `# Términos y Condiciones\n\n## 1. Generalidades\nEl programa de fidelización "{siteName}" es un beneficio exclusivo para nuestros clientes. La participación en el programa es gratuita e implica la aceptación total de los presentes términos y condiciones.\n\n## 2. Privacidad y Datos\nTus datos (Nombre, DNI, Teléfono y Dirección) se utilizan exclusivamente para identificarte como socio, validar tus canjes en el local y enviarte avisos importantes sobre tus puntos. No vendemos ni compartimos tu información con terceros.\n\n## 3. Consentimiento de Comunicaciones\nAl registrarte y/o aceptar los términos en la aplicación, otorgas tu consentimiento explícito para recibir comunicaciones transaccionales y promocionales del {siteName} a través de correo electrónico y notificaciones push. Estas comunicaciones son parte integral del programa de fidelización e incluyen, entre otros, avisos sobre puntos ganados, premios canjeados, promociones especiales y vencimiento de puntos. Puedes gestionar tus preferencias de notificaciones en cualquier momento.\n\n## 4. Sistema de Referidos y Recomendaciones\nEl programa permite a los socios invitar a nuevos usuarios. El socio referente recibirá una bonificación de puntos únicamente cuando el nuevo usuario invitado realice su primera transacción o canje efectivo en el local físico. Nos reservamos el derecho de anular puntos obtenidos mediante prácticas fraudulentas o creación de cuentas ficticias.\n\n## 5. Acumulación de Puntos\nLos puntos se acumularán según la tasa de conversión vigente establecida por el comercio. Los puntos no tienen valor monetario, no son transferibles a otras personas ni canjeable por dinero en efectivo.\n\n## 6. Canje de Premios\nEl canje de premios se realiza exclusivamente en el local físico y será procesado por un administrador del sistema. La PWA sirve como un catálogo para consultar los premios disponibles y los puntos necesarios. Para realizar un canje, el cliente debe presentar una identificación válida.\n\n## 7. Validez y Caducidad\nLos puntos acumulados tienen una fecha de caducidad que se rige por las reglas definidas en el sistema. El cliente será notificado de los vencimientos próximos a través de los canales de comunicación aceptados para que pueda utilizarlos a tiempo.\n\n## 8. Modificaciones del Programa\n{siteName} se reserva el derecho de modificar los términos y condiciones, la tasa de conversión, el catálogo de premios o cualquier otro aspecto del programa de fidelización, inclusive su finalización, en cualquier momento y sin previo aviso.\n\n***\n*Última actualización: 11 de Febrero de 2026*`,
        pwaUrl: typeof window !== 'undefined' ? window.location.origin : ''
    },
    pointsPerPeso: 1,
    pointsMoneyBase: 100,
    pointValue: 10,
    welcomePoints: 100,
    enableWelcomeBonus: true,
    birthdayPoints: 100,
    enableBirthdayBonus: true,
    enableAddressBonus: true,
    pointsForAddress: 50,
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
            birthday: { channels: ['push', 'whatsapp', 'email'] },
            referralReward: { channels: ['email', 'push', 'email'] },
            expirationWarning: { channels: ['push', 'email'] }
        },
        enableExpirationWarnings: false,
        expirationWarningDays: 7,
        automaticCheckHour: 9,
        engineAllowedStartHour: 9,
        engineAllowedEndHour: 22,
        enableDashboardTrigger: true,
        enableClientTrigger: true,
        enableExtensionTrigger: true,
        enableQStashTrigger: true,
        mobileCooldownHours: 24,
        notificationPromptIntervalDays: 30,
        enableLargePrompt: true,
        maxLargePromptDismissalsPC: 2,
        maxLargePromptDismissalsMobile: 2,
        pwaInstallPromptCooldownHours: 24,
        pwaInstallPromptMaxAttempts: 3,
        pwaInstallPromptResetDays: 30,
        enablePwaInstallPromptRepetition: true,
    },
    referrals: {
        enabled: true,
        pointsForReferrer: 200,
        pointsForReferee: 100,
        rewardCriteria: 'first_transaction'
    },
    enableDateSimulator: false,
    simulatedOffsetDays: 0,
    enableDuplicateControl: true,
    enablePetModule: import.meta.env.VITE_ENABLE_PET_MODULE === 'true',
    discountRecoveryRatio: 0
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
                    enablePetModule: data.enablePetModule ?? DEFAULT_APP_CONFIG.enablePetModule,
                    ...data,
                    contact: {
                        ...DEFAULT_APP_CONFIG.contact,
                        ...(data.contact || {})
                    },
                    messaging: {
                        ...DEFAULT_APP_CONFIG.messaging,
                        ...(data.messaging || {}),
                        eventConfigs: {
                            ...DEFAULT_APP_CONFIG.messaging?.eventConfigs,
                            ...(data.messaging?.eventConfigs || {})
                        }
                    },
                    referrals: {
                        ...DEFAULT_APP_CONFIG.referrals,
                        ...(data.referrals || {})
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
            await AuditService.log('config_mgmt', `Configuración del sistema actualizada`, [
                { action: 'config_updated', status: 'success', info: 'Se guardaron cambios en la configuración general' }
            ]);
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    },

    subscribe(callback: (config: AppConfig) => void) {
        const ref = doc(db, CONFIG_DOC_PATH);
        return onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Partial<AppConfig>;
                const fullConfig = {
                    ...DEFAULT_APP_CONFIG,
                    ...data,
                    contact: {
                        ...DEFAULT_APP_CONFIG.contact,
                        ...(data.contact || {})
                    },
                    messaging: {
                        ...DEFAULT_APP_CONFIG.messaging,
                        ...(data.messaging || {}),
                        eventConfigs: {
                            ...DEFAULT_APP_CONFIG.messaging?.eventConfigs,
                            ...(data.messaging?.eventConfigs || {})
                        }
                    },
                    referrals: {
                        ...DEFAULT_APP_CONFIG.referrals,
                        ...(data.referrals || {})
                    }
                } as AppConfig;
                callback(fullConfig);
            }
        });
    },

    getApiKey() {
        return import.meta.env.VITE_API_KEY || '';
    }
};

export const DEFAULT_TEMPLATES = {
    whatsappDefaultMessage: "Hola {nombre}, ¡gracias por tu visita! Tenés {puntos} puntos disponibles. 👋",
    pointsAdded: "¡Hola {nombre}! 🎉 Sumaste {puntos} puntos. Tu nuevo saldo es {saldo} 🪙",
    redemption: "¡Felicidades {nombre}! 🎁 Canjeaste {premio}. Código: {codigo}. ¡Que lo disfrutes! 🏷️",
    welcome: "¡Bienvenido a {siteName}, {nombre}! 🎉 Ya tienes {puntos} puntos de regalo. 🎁",
    campaign: "📢 ¡Nueva Campaña!: {titulo}. {descripcion}. ¡No te la pierdas! 🚀",
    offer: "🎁 ¡Oferta Especial! {titulo}: {detalle}. Válido hasta el {vencimiento}. ⏰",
    flashOffer: "⚡ ¡OFERTA FLASH! {titulo}: {detalle}. Solo disponible hoy hasta las {horario} hs. ⏳",
    birthday: "¡Feliz cumpleaños, {nombre}! 🎂🎉 Te regalamos {puntos} puntos para que los disfrutes. ¡Que pases un gran día! 🎁",
    birthdaySimple: "¡Feliz cumpleaños, {nombre}! 🎂🎉 Esperamos que pases un día increíble. ¡Te enviamos un gran saludo! 🎈",
    referralReward: "¡Hola {nombre}! 🎉 Ganaste {puntos} puntos porque tu amigo {amigo} comenzó a usar {siteName}. ¡Gracias por recomendarnos! 🎁",
    referralPoints: "🎉 ¡Buenas noticias! Ganaste {puntos} puntos porque {nombre_referido} se unió a {siteName}. ¡Gracias por recomendarnos! 🚀",
    expirationWarning: "¡Hola {nombre}! ⏰ Tenés {puntos} puntos para gastar antes del {fecha}. ¡Canjealos hoy por un premio antes de que se venzan! 🎁🏃",
    referralChallenge: "¡NUEVO DESAFÍO ACTIVO! 🎯 Traé amigos a {siteName} y ganá bonos extra de puntos por tiempo limitado. ¡Entrá ahora para participar! 🚀",
    petFoodAlert: "¡Hola {nombre}! 🐾 A {mascota} le queda poco alimento {marca}. ¡Vení a buscar su bolsa y seguí sumando puntos! 🐶🛒"
};
