import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface BonusRule {
    id: string;
    // Naming & Text
    name: string; // Internal Name (Admin purposes)
    title?: string; // Public Title (App)
    showTitle?: boolean; // Toggle for Title

    description?: string; // Public Description
    showDescription?: boolean; // Toggle for Description
    active: boolean;
    daysOfWeek: number[]; // 0=Domingo...
    startDate?: string; // Fecha ISO YYYY-MM-DD
    endDate?: string;   // Fecha ISO YYYY-MM-DD
    imageUrl?: string;  // URL de imagen para banner
    showInApp?: boolean; // Maintain legacy field if needed, but we'll use specific ones
    showInCarousel?: boolean;
    showInHomeBanner?: boolean;
    backgroundColor?: string;
    textColor?: string;
    fontWeight?: 'normal' | 'bold' | 'black';

    // Customization
    imageFit?: 'contain' | 'cover';
    textPosition?: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center' | 'top-left' | 'top-center' | 'top-right';
    fontStyle?: 'sans' | 'serif' | 'mono';

    // Font Sizes
    titleSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    descriptionSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';

    imageOpacity?: number; // 0-100

    // showTitle removed from here as it moved up, but keeping compatibility if needed isn't strict.
    // Cleaned up below.
    buttonText?: string;
    link?: string;

    rewardType: 'FIXED' | 'MULTIPLIER' | 'INFO';
    rewardValue: number;
}

const COLLECTION_NAME = 'campanas';

export const CampaignService = {
    async getAll() {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('name'));
            const snapshot = await getDocs(q);
            const campaigns = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BonusRule[];

            // Trigger maintenance (lazy cleanup)
            await this.performMaintenance(campaigns);

            return campaigns;
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            return [];
        }
    },

    // Internal maintenance to expire campaigns
    async performMaintenance(campaigns: BonusRule[]) {
        try {
            // Get Local YYYY-MM-DD
            const now = new Date();
            // Manually construct YYYY-MM-DD for local time
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            const promises = [];
            for (const b of campaigns) {
                if (b.active && b.endDate && b.endDate < todayStr) {
                    console.log(`[CampaignService] Auto-deactivating expired campaign: ${b.name} (End: ${b.endDate}, Today: ${todayStr})`);
                    // Update DB
                    promises.push(this.update(b.id, { active: false }));
                    // Update in-memory object so UI reflects it immediately
                    b.active = false;
                }
            }
            if (promises.length > 0) await Promise.all(promises);
        } catch (e) {
            console.error("Error in campaign maintenance:", e);
        }
    },

    async create(bonus: Omit<BonusRule, 'id'>) {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), bonus);
            return { id: docRef.id, ...bonus };
        } catch (error) {
            console.error('Error creating campaign:', error);
            throw error;
        }
    },

    async update(id: string, updates: Partial<BonusRule>) {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, updates);
            return true;
        } catch (error) {
            console.error('Error updating campaign:', error);
            throw error;
        }
    },

    async delete(id: string) {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            return true;
        } catch (error) {
            console.error('Error deleting campaign:', error);
            throw error;
        }
    },

    // Helper para obtener bonos activos HOY
    async getActiveBonusesForToday() {
        // getAll already performs maintenance on 'active' flag based on endDate
        const all = await this.getAll();

        const now = new Date();
        const todayDay = now.getDay(); // 0-6
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        return all.filter(b => {
            // 1. Must be active
            if (!b.active) return false;

            // 2. Start Date Check
            if (b.startDate && b.startDate > todayStr) return false;

            if (b.daysOfWeek && b.daysOfWeek.length > 0 && !b.daysOfWeek.includes(todayDay)) return false;

            return true;
        });
    },

    // Helper para obtener TODAS las campañas activas por fecha (Catalogo completo)
    async getActiveCampaignsInDateRange() {
        const all = await this.getAll();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        return all.filter(b => {
            if (!b.active) return false;
            // Solo chequeamos fechas, NO días de la semana
            if (b.startDate && b.startDate > todayStr) return false;
            if (b.endDate && b.endDate < todayStr) return false;
            return true;
        });
    }
};
