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

    async sendBirthdayGreeting(uid: string, userData: any, config: any, options: { forcePointsText?: boolean, cleanMessage?: boolean } = {}) {
        try {
            const birthdayPoints = config?.birthdayPoints || 100;
            const birthdayTemplate = config?.messaging?.templates?.birthday || DEFAULT_TEMPLATES.birthday;

            const now = TimeService.now();
            const currentYear = now.getFullYear().toString();
            const pointsGivenThisYear = userData.lastBirthdayPointsYear === currentYear;
            const willGivePointsAuto = config?.enableBirthdayBonus !== false; // If auto is ON, we assume points are/will be there.

            let msg = birthdayTemplate;

            // 1. Ensure Emojis exist (if using old default template text)
            // If the message looks like the old default but misses emojis, let's upgrade it on the fly for display.
            if (msg.includes("Feliz cumpleaños") && !msg.includes("🎂")) {
                msg = msg.replace("Feliz cumpleaños", "¡Feliz cumpleaños 🎂🎉");
            }
            if (msg.includes("gran día") && !msg.includes("✨")) {
                msg = msg.replace("gran día", "gran día ✨");
            }

            // 2. Personalize Name
            msg = msg
                .replace(/{nombre}/g, userData.name.split(' ')[0])
                .replace(/{nombre_completo}/g, userData.name);

            // 3. Conditional Points Text
            let shouldShowPoints = false;

            if (options.cleanMessage) {
                shouldShowPoints = false; // Forced Clean
            } else if (options.forcePointsText) {
                shouldShowPoints = true; // Forced Points
            } else {
                // Default auto behavior
                shouldShowPoints = pointsGivenThisYear || willGivePointsAuto;
            }

            if (!shouldShowPoints) {
                // Remove "Te regalamos..." sentence efficiently.
                // Matches: "Te regalamos" ... (anything) ... end of sentence (. or ! or next capitalized start if missing punct?)
                // We use a broader match that kills the phrase "Te regalamos" and everything up to the next dot/exclamation.
                msg = msg.replace(/Te regalamos.*?[\.!]/gi, '');

                // Fallback: If regex failed due to missing punctuation in user config:
                // Remove common variations specifically
                msg = msg.replace(/Te regalamos.*?puntos.*?disfrutes/gi, '');
                msg = msg.replace(/Te regalamos.*?puntos.*?difrutes/gi, ''); // Handle typo "difrutes"

                // Cleanup loose vars if any remain
                msg = msg.replace(/{puntos} puntos/gi, '');
                msg = msg.replace(/{puntos}/g, '');
            } else {
                msg = msg.replace(/{puntos}/g, birthdayPoints.toString());
            }

            // 4. Cleanup
            // Fix double spaces and ensure spacing around punctuation is correct
            msg = msg.replace(/\s+/g, ' ')
                .replace(/\s+([\.!¡\?,])/g, '$1') // remove space before dots/exclamations
                .replace(/\.\./g, '.') // fix double dots
                .trim();

            let pushSent = false;
            let emailSent = false;
            let whatsappLink = undefined;

            // 1. Send Push/Inbox (Default or if enabled)
            if (NotificationService.isChannelEnabled(config, 'birthday', 'push')) {
                await NotificationService.sendToClient(uid, {
                    title: '¡Feliz Cumpleaños! 🎂',
                    body: msg,
                    type: 'birthday',
                    icon: config?.logoUrl || '/logo.png'
                });
                pushSent = true;
            }

            // 2. Send Email
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

            // 3. Prepare WhatsApp Link
            if (NotificationService.isChannelEnabled(config, 'birthday', 'whatsapp') && (userData.phone || userData.telefono)) {
                const rawPhone = userData.phone || userData.telefono;
                const cleanPhone = rawPhone.replace(/\D/g, '');

                // Ensure proper encoding for URL
                if (cleanPhone) {
                    // Use api.whatsapp.com/send for broader compatibility (web + mobile)
                    whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
                }
            }

            return { success: true, pushSent, emailSent, whatsappLink, message: msg };
        } catch (e) {
            console.error(e);
            return { success: false, error: e };
        }
    }
};
