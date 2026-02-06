import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import { TimeService } from './timeService';
import { NotificationService } from './notificationService';
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

        console.log("🎉 It's your birthday! Assigning gifts...");

        try {
            // 1. Assign Points (if configured)
            // For now, let's use a default of 50 points or something from config if we add it later
            // Since there's no explicit config field yet in AppConfig, I'll use 100 as default 
            const birthdayPoints = 100;

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
            const msg = `¡Feliz cumpleaños, ${userData.name}! 🎉 Te regalamos ${birthdayPoints} puntos para celebrar tu día. ¡Que lo pases increíble!`;

            await NotificationService.sendToClient(uid, {
                title: '¡Feliz Cumpleaños! 🎂',
                body: msg,
                type: 'offer',
                icon: config?.logoUrl || '/logo.png'
            });

            toast.success("¡Feliz Cumpleaños! Te hemos regalado 100 puntos. 🎂", { duration: 6000, icon: '🎉' });

        } catch (error) {
            console.error("Error processing birthday gift:", error);
        }
    }
};
