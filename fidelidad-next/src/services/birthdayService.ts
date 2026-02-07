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
        const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const birthMD = userData.birthDate.substring(5); // Assumes YYYY-MM-DD

        if (todayMD !== birthMD) return;

        const currentYear = now.getFullYear().toString();
        const lastBirthdayPointsYear = userData.lastBirthdayPointsYear || "";

        // 1. Process Points (if enabled and not already given)
        if (config?.enableBirthdayBonus !== false && lastBirthdayPointsYear !== currentYear) {
            await this.giveBirthdayPoints(uid, userData, config);
        }

        // 2. Process Message (if enabled)
        // Check if message is already sent today? We don't track message sent specifically in user doc, maybe we should?
        // For now, relies on 'enableBirthdayMessage' config.
        if (config?.enableBirthdayMessage !== false) {
            // We don't want to spam, but client side check runs once per session/day ideally.
            // We can check local storage or just rely on the fact checking happens on login.
            // But if we want to support manual sending from dashboard, we should separate this.
            await this.sendBirthdayGreeting(uid, userData, config);
        }
    },

    async giveBirthdayPoints(uid: string, userData: any, config: any) {
        const now = TimeService.now();
        const currentYear = now.getFullYear().toString();

        // Double check to be safe, though Dashboard might bypass
        if (userData.lastBirthdayPointsYear === currentYear) {
            console.log("Points already given for this year.");
            return false;
        }

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

            toast.success(`Se regalaron ${birthdayPoints} puntos a ${userData.name}`);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async sendBirthdayGreeting(uid: string, userData: any, config: any, options: { mode?: 'full' | 'clean' | 'gift_only' } = {}) {
        try {
            const birthdayPoints = config?.birthdayPoints || 100;
            const birthdayTemplate = config?.messaging?.templates?.birthday || DEFAULT_TEMPLATES.birthday;

            const now = TimeService.now();
            const currentYear = now.getFullYear().toString();

            let msg = "";

            // 1. CONSTRUCT MESSAGE ACCORDING TO MODE
            if (options.mode === 'gift_only') {
                msg = `¡{nombre}! 🎁 Te acabamos de acreditar {puntos} puntos de regalo por tu cumple. ¡Disfrútalos! 🥳`;
            } else {
                msg = birthdayTemplate;

                // Ensure Emojis exist
                if (msg.includes("Feliz cumpleaños") && !msg.includes("🎂")) {
                    msg = msg.replace("Feliz cumpleaños", "¡Feliz cumpleaños 🎂🎉");
                }
                if (msg.includes("gran día") && !msg.includes("✨")) {
                    msg = msg.replace("gran día", "gran día ✨");
                }

                if (options.mode === 'clean') {
                    // Remove "Te regalamos..." sentence efficiently.
                    msg = msg.replace(/Te regalamos.*?[\.!¡]/gi, '');
                    msg = msg.replace(/Te regalamos.*?puntos.*?difrutes/gi, '');
                    msg = msg.replace(/Te regalamos.*?puntos.*?disfrutes/gi, '');
                    msg = msg.replace(/{puntos}/gi, '');
                } else {
                    // Default or 'full'
                    msg = msg.replace(/{puntos}/g, birthdayPoints.toString());
                }
            }

            // 2. Personalize Name
            msg = msg
                .replace(/{nombre}/g, userData.name.split(' ')[0])
                .replace(/{nombre_completo}/g, userData.name)
                .replace(/{puntos}/g, birthdayPoints.toString());

            // 3. Final Cleanup
            msg = msg.replace(/\s+/g, ' ')
                .replace(/\s+([\.!¡\?,])/g, '$1')
                .replace(/\.\./g, '.')
                .trim();

            let pushSent = false;
            let emailSent = false;
            let whatsappLink = undefined;

            // 4. Send Channels
            if (NotificationService.isChannelEnabled(config, 'birthday', 'push')) {
                await NotificationService.sendToClient(uid, {
                    title: '¡Feliz Cumpleaños! 🎂',
                    body: msg,
                    type: 'birthday',
                    icon: config?.logoUrl || '/logo.png'
                });
                pushSent = true;
            }

            if (NotificationService.isChannelEnabled(config, 'birthday', 'email') && userData.email) {
                try {
                    const auth = (await import('../lib/firebase')).auth;
                    const token = await auth.currentUser?.getIdToken();
                    if (token) {
                        await fetch('/api/send-email', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                to: userData.email,
                                templateId: 'manual_override',
                                templateData: {
                                    subject: '¡Feliz Cumpleaños! 🎂',
                                    htmlContent: `<p>${msg}</p>`
                                }
                            })
                        });
                        emailSent = true;
                    }
                } catch (e) {
                    console.error("Error sending birthday email:", e);
                }
            }

            if (NotificationService.isChannelEnabled(config, 'birthday', 'whatsapp') && (userData.phone || userData.telefono)) {
                const rawPhone = userData.phone || userData.telefono;
                const cleanPhone = rawPhone.replace(/\D/g, '');
                if (cleanPhone) {
                    whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
                }
            }

            // 5. Persist Greeting State in DB
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                lastBirthdayGreetingYear: currentYear
            });

            return { success: true, pushSent, emailSent, whatsappLink, message: msg };
        } catch (e) {
            console.error(e);
            return { success: false, error: e };
        }
    }
};
