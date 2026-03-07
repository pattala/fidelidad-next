
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, increment } from 'firebase/firestore';

import { TimeService } from './timeService';

export const ExpirationService = {
    /**
     * Checks for expired points and processes them:
     * 1. Identifies expired history records that haven't been processed.
     * 2. Sums them up.
     * 3. Deducts from user balance.
     * 4. Adds a debit record to history.
     * 5. Marks original records as processed.
     */
    async processExpirations(userId: string) {
        if (!userId) return;

        try {
            const now = TimeService.now();
            // We want points to be valid THROUGH the expiration day.
            // So they expire if expirationDate < startOfToday.
            // Example: expiresAt 2024-01-09 00:00. Today (Simulated) is Jan 9. 
            // 2024-01-09 < 2024-01-09 is False. They are valid.
            // Tomorrow (Jan 10), 2024-01-09 < 2024-01-10 is True. They expire.
            const startOfToday = TimeService.startOfToday();

            // Query for UNPROCESSED expired items
            const historyRef = collection(db, `users/${userId}/points_history`);
            const q = query(
                historyRef,
                where('expiresAt', '<', startOfToday) // Strict check: Expired ONLY if strictly before today
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) return;

            let totalExpired = 0;
            const docsToUpdate: any[] = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Check if already processed to be safe (idempotency)
                if (data.status === 'expired') return;

                // CRITICAL FIX: Only expire what is REMAINING. 
                // If remainingPoints is undefined (legacy), assume amount.
                // If remainingPoints is 0 (consumed), it contributes 0 to expiration.
                const currentRemaining = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;

                if (data.type === 'credit' && currentRemaining > 0) {
                    totalExpired += currentRemaining;
                    docsToUpdate.push({ doc, expiredAmount: currentRemaining });
                }
            });

            if (totalExpired > 0) {
                const batch = writeBatch(db);

                // 1. Mark old records as expired and ZERO out balance
                docsToUpdate.forEach(({ doc: docSnap, expiredAmount }) => {
                    batch.update(docSnap.ref, {
                        status: 'expired',
                        remainingPoints: 0, // Ensure it's visually empty
                        expiredAmount: expiredAmount, // Audit: How much was actually lost
                        processedAt: now
                    });
                });

                // 2. Add Debit Record
                const newHistoryRef = doc(collection(db, `users/${userId}/points_history`));
                batch.set(newHistoryRef, {
                    amount: -totalExpired,
                    concept: 'Vencimiento de puntos acumulados',
                    date: now,
                    type: 'debit',
                    isExpirationAdjustment: true
                });

                // 3. Update User Balance
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, {
                    points: increment(-totalExpired)
                });

                await batch.commit();
                console.log(`[ExpirationService] Processed ${totalExpired} expired points for user ${userId}`);
                return totalExpired;
            }

        } catch (error) {
            console.error("[ExpirationService] Error processing expirations:", error);
            throw error;
        }
    }
};
