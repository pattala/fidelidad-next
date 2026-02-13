import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import { TimeService } from './timeService';
import { NotificationService } from './notificationService';
import { DEFAULT_TEMPLATES } from './configService';
import toast from 'react-hot-toast';

export const BirthdayService = {
    async checkAndProcessBirthday(uid: string, userData: any, config: any) {
        if (!userData?.birthDate) return;

        const now = TimeService.now();
        const currentYear = now.getFullYear().toString();
        const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const birthMD = userData.birthDate.substring(5); // YYYY-MM-DD

        // 1. Validar si es el cumpleaños
        if (todayMD !== birthMD) return;

        // 2. FRENO DE MANO: Si ya se saludó este año, SALIR INMEDIATAMENTE.
        // Esto evita el bucle de notificaciones que se ve en la imagen.
        if (userData.lastBirthdayGreetingYear === currentYear) {
            console.log("Cumpleaños ya procesado hoy. Abortando auto-proceso.");
            return;
        }

        console.log("Procesando cumpleaños automático para:", userData.name);

        // 3. Lógica según CONFIGURACIÓN
        const autoBonusEnabled = config?.enableBirthdayBonus === true; // Solo si es TRUE explícito
        const autoMessageEnabled = config?.enableBirthdayMessage !== false; // Default true

        // 4. Ejecutar acciones
        if (autoBonusEnabled && userData.lastBirthdayPointsYear !== currentYear) {
            await this.giveBirthdayPoints(uid, userData, config);
            // Si regalamos, mandamos saludo con puntos
            if (autoMessageEnabled) {
                await this.sendBirthdayGreeting(uid, userData, config, { mode: 'full' });
            }
        } else if (autoMessageEnabled) {
            // Si NO regalamos puntos, el saludo DEBE ser limpio
            await this.sendBirthdayGreeting(uid, userData, config, { mode: 'clean' });
        }
    },

    async giveBirthdayPoints(uid: string, userData: any, config: any) {
        const now = TimeService.now();
        const currentYear = now.getFullYear().toString();

        if (userData.lastBirthdayPointsYear === currentYear) return false;

        try {
            const birthdayPoints = config?.birthdayPoints || 100;
            const userRef = doc(db, 'users', uid);
            const historyRef = collection(db, 'users', uid, 'points_history');

            const expirationDate = new Date(now);
            expirationDate.setDate(expirationDate.getDate() + 365);

            await addDoc(historyRef, {
                amount: birthdayPoints,
                concept: '🎂 ¡Feliz Cumpleaños! Regalo del Club',
                date: now,
                type: 'credit',
                expiresAt: expirationDate,
                remainingPoints: birthdayPoints
            });

            await updateDoc(userRef, {
                points: increment(birthdayPoints),
                lastBirthdayPointsYear: currentYear
            });

            toast.success(`Se regalaron ${birthdayPoints} puntos.`);
            return true;
        } catch (e) {
            console.error("Error giving points:", e);
            return false;
        }
    },

    async sendBirthdayGreeting(uid: string, userData: any, config: any, options: { mode?: 'full' | 'clean' | 'gift_only', whatsappOnly?: boolean } = {}) {
        try {
            const now = TimeService.now();
            const currentYear = now.getFullYear().toString();
            const birthdayPoints = config?.birthdayPoints || 100;

            let msg = "";

            // --- CONSTRUCCIÓN DE MENSAJE ---
            if (options.mode === 'gift_only') {
                msg = `¡{nombre}! 🎁 Te acabamos de acreditar {puntos} puntos de regalo por tu cumple. ¡Disfrútalos! 🥳`;
            } else {
                // Elegir plantilla base
                const templateFull = config?.messaging?.templates?.birthday || DEFAULT_TEMPLATES.birthday;
                const templateSimple = config?.messaging?.templates?.birthdaySimple || DEFAULT_TEMPLATES.birthdaySimple;

                msg = (options.mode === 'clean') ? templateSimple : templateFull;

                if (msg.includes("Feliz cumpleaños") && !msg.includes("🎂")) msg = msg.replace("Feliz cumpleaños", "¡Feliz cumpleaños 🎂🎉");
                if (msg.includes("gran día") && !msg.includes("✨")) msg = msg.replace("gran día", "gran día ✨");

                if (options.mode !== 'clean') {
                    msg = msg.replace(/{puntos}/g, birthdayPoints.toString());
                }
            }

            msg = msg.replace(/{nombre}/g, (userData.name || '').split(' ')[0])
                .replace(/{nombre_completo}/g, userData.name || '')
                .replace(/{puntos}/g, birthdayPoints.toString());

            msg = msg.replace(/\s+/g, ' ').replace(/\s+([.!¡?,])/g, '$1').trim();

            let pushSent = false;
            let emailSent = false;
            let whatsappLink = undefined;

            // --- CANALES ---
            if (!options.whatsappOnly) {
                // 1. Push (Guardamos en inbox)
                if (NotificationService.isChannelEnabled(config, 'birthday', 'push')) {
                    await NotificationService.sendToClient(uid, {
                        title: '¡Feliz Cumpleaños! 🎂',
                        body: msg,
                        type: 'birthday',
                        icon: config?.logoUrl || '/logo.png'
                    });
                    pushSent = true;
                }

                // 2. Email
                if (userData.email && NotificationService.isChannelEnabled(config, 'birthday', 'email')) {
                    try {
                        const token = await (await import('../lib/firebase')).auth.currentUser?.getIdToken();
                        if (token) {
                            await fetch('/api/send-email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({
                                    to: userData.email,
                                    templateId: 'manual_override',
                                    templateData: { subject: '¡Feliz Cumpleaños! 🎂', htmlContent: `<p>${msg}</p>` }
                                })
                            });
                            emailSent = true;
                        }
                    } catch (e) { }
                }

                // MARCAR SALUDO EN DB (CRÍTICO) - Solo si mandamos canales automáticos
                // Para evitar bucles infinitos si falla el envío pero se intenta.
                await updateDoc(doc(db, 'users', uid), {
                    lastBirthdayGreetingYear: currentYear
                });
            }

            // WhatsApp link (Siempre se genera si hay teléfono)
            const phone = userData.phone || userData.telefono;
            if (phone) {
                const cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone) whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
            }

            return { success: true, pushSent, emailSent, whatsappLink, message: msg };
        } catch (e) {
            console.error("Error sending greeting:", e);
            return { success: false, error: e };
        }
    }
};
