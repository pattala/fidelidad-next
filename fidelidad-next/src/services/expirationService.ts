
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
                    points: increment(-totalExpired),
                    puntos: increment(-totalExpired)
                });

                await batch.commit();
                console.log(`[ExpirationService] Processed ${totalExpired} expired points for user ${userId}`);

                // Actualizar cache de próximo vencimiento después de procesar
                await this.updateNextExpirationCache(userId);

                return totalExpired;
            }

        } catch (error) {
            console.error("[ExpirationService] Error processing expirations:", error);
            throw error;
        }
    },

    /**
     * Scans the user's active points history and caches the EARLIEST upcoming expiration.
     * This is used by the Cron Job to find users to notify quickly.
     */
    async updateNextExpirationCache(userId: string) {
        if (!userId) return;
        try {
            const startOfToday = TimeService.startOfToday();
            const historyRef = collection(db, `users/${userId}/points_history`);

            // Query credits. We filter by remainingPoints in JS to support legacy records
            const q = query(
                historyRef,
                where('type', '==', 'credit')
                // Removed 'remainingPoints' > 0 because it skips legacy records where field is missing
            );

            const snapshot = await getDocs(q);

            let nextDate: Date | null = null;
            let nextAmount = 0;

            snapshot.docs.forEach(d => {
                const data = d.data();
                const currentRemaining = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;

                // Skip if no points left or already marked as expired
                if (currentRemaining <= 0 || data.status === 'expired') return;

                if (data.expiresAt) {
                    const expireDate = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

                    // Only care about future expirations (strictly from today inclusive)
                    if (expireDate >= startOfToday) {
                        if (!nextDate || expireDate < nextDate) {
                            nextDate = expireDate;
                            nextAmount = currentRemaining;
                        } else if (expireDate.getTime() === nextDate.getTime()) {
                            // Sum amounts if they expire on the same day
                            nextAmount += currentRemaining;
                        }
                    }
                }
            });

            // Update user profile
            const userRef = doc(db, 'users', userId);
            const isoDate = nextDate ? (nextDate as Date).toISOString().split('T')[0] : null;

            await writeBatch(db).update(userRef, {
                nextExpirationDate: isoDate,
                nextExpirationAmount: nextDate ? nextAmount : 0
            }).commit();

            console.log(`[ExpirationService] Updated expiration cache for ${userId}: ${isoDate || 'None'}`);
        } catch (error) {
            console.error("[ExpirationService] Error updating expiration cache:", error);
        }
    },

    /**
     * Aggregates metrics for a specific client from their history
     */
    async getClientMetrics(userId: string) {
        if (!userId) {
            return { expiring: 0, totalspent: 0, redeemedPoints: 0, redeemedValue: 0, expirations: [] };
        }

        try {
            const historyRef = collection(db, `users/${userId}/points_history`);
            const snap = await getDocs(historyRef);

            let expiring = 0;
            let virtualExpired = 0;
            let totalspent = 0;
            let redeemedPoints = 0;
            let redeemedValue = 0;
            const expDates: { [key: string]: number } = {};
            const startOfToday = TimeService.startOfToday();

            snap.docs.forEach(d => {
                const hData = d.data();
                if (hData.status === 'expired' || hData.isExpirationAdjustment) return;

                const rawAmount = hData.amount ?? hData.puntos ?? 0;
                const amount = Number(rawAmount);
                const type = (hData.type || '').toLowerCase();

                if (type === 'credit') {
                    const remaining = hData.remainingPoints !== undefined ? Number(hData.remainingPoints) : amount;
                    
                    // Money Spent
                    if (hData.moneySpent !== undefined) {
                        totalspent += Number(hData.moneySpent);
                    }

                    // Expiration Logic
                    if (hData.expiresAt) {
                        const expiresAt = hData.expiresAt.toDate ? hData.expiresAt.toDate() : new Date(hData.expiresAt);
                        
                        if (expiresAt < startOfToday) {
                            // Deberían estar vencidos pero están activos (Virtual Expiry)
                            virtualExpired += remaining;
                        } else {
                            // Vencen hoy o en el futuro (Expiring soon)
                            if (remaining > 0) {
                                expiring += remaining;
                                const dateKey = expiresAt.toISOString().split('T')[0];
                                expDates[dateKey] = (expDates[dateKey] || 0) + remaining;
                            }
                        }
                    }
                } else if (type === 'debit') {
                    redeemedPoints += Math.abs(amount);
                    redeemedValue += Number(hData.redeemedValue || 0);
                }
            });

            const expirations = Object.entries(expDates).map(([date, points]) => ({
                date: new Date(date + 'T12:00:00'),
                points
            }));

            return { expiring, virtualExpired, totalspent, redeemedPoints, redeemedValue, expirations };
        } catch (error) {
            console.error("[ExpirationService] Error getting client metrics:", error);
            return { expiring: 0, totalspent: 0, redeemedPoints: 0, redeemedValue: 0, expirations: [] };
        }
    }
};
