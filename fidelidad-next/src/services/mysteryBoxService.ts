import { collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ConfigService } from './configService';

export interface MysteryBoxChance {
    id: string; // The generated unique code
    clientId: string;
    clientDni?: string;
    clientName?: string;
    branchId: string;
    cashierId: string;
    amount: number;
    status: 'pending' | 'played' | 'rejected' | 'expired';
    pointsWon: number;
    expiresAt: Timestamp; // Deadline for the client to play
    resendExpiresAt: Timestamp; // Deadline for the cashier to resend
    createdAt: Timestamp;
    playedAt?: Timestamp;
    rejectedAt?: Timestamp;
    qrScanned: boolean; // Security check to see if the QR was scanned
}

export const MysteryBoxService = {
    // 1. Generate a new chance when a purchase qualifies
    async generateChance(data: {
        clientId: string;
        clientDni?: string;
        clientName?: string;
        amount: number;
        branchId: string;
        cashierId: string;
    }): Promise<string | null> {
        const config = await ConfigService.get();
        if (!config.mysteryBox?.enabled || data.amount < config.mysteryBox.minAmount) {
            return null; // Does not qualify or system disabled
        }

        const id = 'MBX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ((config.mysteryBox.chanceDeadlineMinutes || 60) * 60 * 1000));
        const resendExpiresAt = new Date(now.getTime() + ((config.mysteryBox.resendDeadlineMinutes || 60) * 60 * 1000));

        const chance: MysteryBoxChance = {
            id,
            ...data,
            status: 'pending',
            pointsWon: 0,
            expiresAt: Timestamp.fromDate(expiresAt),
            resendExpiresAt: Timestamp.fromDate(resendExpiresAt),
            createdAt: Timestamp.fromDate(now),
            qrScanned: false
        };

        const ref = doc(db, 'mystery_box_chances', id);
        await setDoc(ref, chance);

        return id;
    },

    // 2. Fetch a chance by ID (used by the PWA when scanning QR)
    async getChance(id: string): Promise<MysteryBoxChance | null> {
        const ref = doc(db, 'mystery_box_chances', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;

        const data = snap.data() as MysteryBoxChance;
        
        // Auto-expire check
        if (data.status === 'pending' && data.expiresAt.toDate() < new Date()) {
            await updateDoc(ref, { status: 'expired' });
            return { ...data, status: 'expired' };
        }

        return data;
    },

    // 3. Mark QR as scanned (Security Measure)
    // 2.5 Buscar sorteos pendientes por DNI (Para el QR Generico)
    async getPendingByDni(dni: string): Promise<MysteryBoxChance[]> {
        const now = new Date();
        // Limpiamos el DNI
        const cleanDni = dni.trim().replace(/[^0-9]/g, '');
        if (!cleanDni) return [];

        const q = query(
            collection(db, 'mysteryBoxChances'),
            where('clientDni', '==', cleanDni),
            where('status', '==', 'pending')
        );

        const snap = await getDocs(q);
        const chances: MysteryBoxChance[] = [];
        
        snap.forEach(doc => {
            const data = doc.data() as MysteryBoxChance;
            data.id = doc.id;
            // Verificar expiracion
            if (data.expiresAt && data.expiresAt.toDate() > now) {
                chances.push(data);
            }
        });

        // Ordenamos para devolver el mas reciente primero
        return chances.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
    },

    // 3. Mark QR as scanned (Security Measure)
    async markAsScanned(id: string): Promise<boolean> {
        const chance = await this.getChance(id);
        if (!chance || chance.status !== 'pending' || chance.qrScanned) {
            return false;
        }

        const ref = doc(db, 'mystery_box_chances', id);
        await updateDoc(ref, { qrScanned: true });
        return true;
    },

    // 4. Reject the game
    async rejectChance(id: string): Promise<boolean> {
        const chance = await this.getChance(id);
        if (!chance || chance.status !== 'pending') return false;

        const ref = doc(db, 'mystery_box_chances', id);
        await updateDoc(ref, {
            status: 'rejected',
            rejectedAt: Timestamp.now()
        });
        return true;
    },

    // 5. Play the game and get result
    async playChance(id: string): Promise<number | null> {
        const chance = await this.getChance(id);
        if (!chance || chance.status !== 'pending') return null;

        const config = await ConfigService.get();
        if (!config.mysteryBox?.enabled || !config.mysteryBox.prizeScales.length) {
            return null;
        }

        // Calculate prize based on probabilities
        const random = Math.random() * 100;
        let cumulative = 0;
        let selectedScale = config.mysteryBox.prizeScales[config.mysteryBox.prizeScales.length - 1]; // Default to last if floating point issues

        for (const scale of config.mysteryBox.prizeScales) {
            cumulative += scale.probabilityPct;
            if (random <= cumulative) {
                selectedScale = scale;
                break;
            }
        }

        // Random points within the scale's range
        const pointsWon = Math.floor(Math.random() * (selectedScale.maxPoints - selectedScale.minPoints + 1)) + selectedScale.minPoints;

        // Update the chance
        const ref = doc(db, 'mystery_box_chances', id);
        await updateDoc(ref, {
            status: 'played',
            pointsWon,
            playedAt: Timestamp.now()
        });

        // The caller (PWA endpoint/service) should then credit the points to the user 
        // with the specific expiration date! We do that separately to keep this service focused.
        // Wait, the mysteryBoxService was implemented to do this logic in MysteryBoxPage? Let's verify...
        // Ah, the points assignment is actually done in the PWA page.
        // But the points_history addition should be done here if we refactor it, or in the page.
        // I will keep it in the page since it requires the user UID.
        return pointsWon;
    },

    // 6. Get pending chances for a cashier (for the resend bubble)
    async getPendingChancesForCashier(): Promise<MysteryBoxChance[]> {
        const now = new Date();
        const ref = collection(db, 'mystery_box_chances');
        const q = query(
            ref, 
            where('status', '==', 'pending')
        );

        const snap = await getDocs(q);
        const chances: MysteryBoxChance[] = [];
        snap.forEach(doc => {
            const data = doc.data() as MysteryBoxChance;
            if (data.resendExpiresAt.toDate() > now) {
                chances.push(data);
            }
        });

        // Sort by creation date descending
        return chances.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
    }
};
