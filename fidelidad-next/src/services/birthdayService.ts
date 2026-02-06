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

    async sendBirthdayGreeting(uid: string, userData: any, config: any) {
        try {
            const birthdayPoints = config?.birthdayPoints || 100;
            const birthdayTemplate = config?.messaging?.templates?.birthday || DEFAULT_TEMPLATES.birthday;

            const msg = birthdayTemplate
                .replace(/{nombre}/g, userData.name.split(' ')[0])
                .replace(/{nombre_completo}/g, userData.name)
                .replace(/{puntos}/g, birthdayPoints.toString());

            await NotificationService.sendToClient(uid, {
                title: '¡Feliz Cumpleaños! 🎂',
                body: msg,
                type: 'birthday',
                icon: config?.logoUrl || '/logo.png'
            });

            // toast.success(`Saludo enviado a ${userData.name}`); // Optional
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};

