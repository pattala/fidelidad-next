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

        if (lastBirthdayPointsYear === currentYear) {
            console.log("Birthday points already assigned for this year.");
            return;
        }

        // Check if Birthday Bonus is enabled
        if (config?.enableBirthdayBonus === false) {
            console.log("Birthday bonus is disabled in configuration.");
            return;
        }

        console.log("🎉 It's your birthday! Assigning gifts...");

        try {
            // 1. Get Dynamic Config
            const birthdayPoints = config?.birthdayPoints || 100;
            const birthdayTemplate = config?.messaging?.templates?.birthday || DEFAULT_TEMPLATES.birthday;

            const userRef = doc(db, 'users', uid);
            const historyRef = collection(db, 'users', uid, 'points_history');

            const expirationDate = new Date(now);
            expirationDate.setDate(expirationDate.getDate() + 365); // Standard 1 year validity

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

            // 2. Send Notifications
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

            toast.success(`¡Feliz Cumpleaños! Te hemos regalado ${birthdayPoints} puntos. 🎂`, { duration: 6000, icon: '🎉' });

        } catch (error) {
            console.error("Error processing birthday gift:", error);
        }
    }
};
