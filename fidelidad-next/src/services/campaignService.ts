import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AuditService } from './auditService';
import { TimeService } from './timeService';

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
    startTime?: string; // Formato HH:mm
    endTime?: string;   // Formato HH:mm
    imageUrl?: string;  // URL de imagen para banner
    showInApp?: boolean; // Maintain legacy field if needed, but we'll use specific ones
    showInCarousel?: boolean;
    showInHomeBanner?: boolean;
    backgroundColor?: string;
    textColor?: string;
    titleColor?: string;
    descriptionColor?: string;

    // Customization
    imageFit?: 'contain' | 'cover';
    textPosition?: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center' | 'top-left' | 'top-center' | 'top-right';
    // Typography - Title
    titleFont?: 'sans' | 'serif' | 'mono';
    titleWeight?: 'normal' | 'bold' | 'black' | 'light';

    // Typography - Description
    descFont?: 'sans' | 'serif' | 'mono';
    descWeight?: 'normal' | 'bold' | 'black' | 'light';

    // Legacy (to be deprecated or used as fallback)
    fontStyle?: 'sans' | 'serif' | 'mono';
    fontWeight?: 'normal' | 'bold' | 'black' | 'light';

    // Font Sizes
    titleSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    descriptionSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';

    imageOpacity?: number; // 0-100
    bannerOpacity?: number; // 0-100 (Transparency for background)

    // showTitle removed from here as it moved up, but keeping compatibility if needed isn't strict.
    // Cleaned up below.
    buttonText?: string;
    link?: string;

    // Standard Reward
    rewardType: 'FIXED' | 'MULTIPLIER' | 'TEXT' | 'INFO';
    rewardValue: number;
    rewardText?: string;

    // Flash Reward (Independent)
    isFlash?: boolean;
    flashTitle?: string;
    flashDescription?: string;
    autoBroadcast?: boolean;
    broadcastLeadMins?: number;
    broadcastSentAt?: string;
    additionalBroadcastDates?: string[];
    
    // Legacy support para flash
    flashRewardType?: 'POINTS' | 'MULTIPLIER' | 'FIXED' | 'INFO' | 'TEXT';
    flashRewardValue?: number;
    flashRewardText?: string;
    flashDays?: number[];
    flashGraceMins?: number;

    channels?: string[]; // push, email, whatsapp
    autoBroadcast?: boolean; // New: Automatic push/email broadcast
    broadcastSentAt?: string; // New: ISO Timestamp of when it was sent
    broadcastLeadMins?: number; // New: Minutes before startTime to send notification
    actionUrl?: string;  // URL for floating modal link
    actionText?: string; // Text for floating modal button
    isInternal?: boolean;
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
            const now = TimeService.now();
            // Manually construct YYYY-MM-DD for local time
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            const promises = [];
            for (const b of campaigns) {
                if (b.active && b.endDate) {
                    const isExpiredDate = b.endDate < todayStr;

                    // Calculation for time-based expiration including grace
                    let isExpiredTime = false;
                    // Solo para TRADICIONALES con fecha de fin hoy.
                    if (!b.isFlash && b.endDate === todayStr && b.endTime) {
                        const [h, m] = b.endTime.split(':').map(Number);
                        const grace = 0; // Eliminamos gracia para evitar confusiones de estado

                        const expireTimestamp = new Date(now);
                        expireTimestamp.setHours(h, m + grace, 0, 0);

                        if (now > expireTimestamp) {
                            isExpiredTime = true;
                        }
                    }

                    if (isExpiredDate || isExpiredTime) {
                        console.log(`[CampaignService] Auto-deactivating expired campaign: ${b.name} (Grace: ${b.flashGraceMins || 0}m)`);
                        // Update DB
                        promises.push(this.update(b.id, { active: false }));
                        // Update in-memory object
                        b.active = false;
                    }
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
            await AuditService.log('campaign_mgmt', `Campaña creada: ${bonus.name}`, [
                { action: 'campaign_created', status: 'success', info: `Nombre: ${bonus.name}, Tipo: ${bonus.rewardType}` }
            ]);
            return { id: docRef.id, ...bonus };
        } catch (error) {
            console.error('Error creating campaign:', error);
            throw error;
        }
    },

    async update(id: string, updates: Partial<BonusRule>) {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            
            // Sanitize: Firebase updateDoc forbids 'undefined' values.
            // We strip them out while keeping nulls or other empty values.
            const cleanUpdates = Object.entries(updates).reduce((acc, [key, val]) => {
                if (val !== undefined) acc[key] = val;
                return acc;
            }, {} as any);

            if (Object.keys(cleanUpdates).length === 0) return true;

            await updateDoc(docRef, cleanUpdates);
            // Evitar loggear el mantenimiento automático para no llenar la bitácora
            if (!Object.keys(updates).every(k => k === 'active')) {
                await AuditService.log('campaign_mgmt', `Campaña actualizada (ID: ${id.slice(0, 5)}...)`, [
                    { action: 'campaign_updated', status: 'success', info: `Cambios: ${Object.keys(updates).join(', ')}` }
                ]);
            }
            return true;
        } catch (error) {
            console.error('Error updating campaign:', error);
            throw error;
        }
    },

    async delete(id: string) {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            await AuditService.log('campaign_mgmt', `Campaña eliminada (ID: ${id})`, [
                { action: 'campaign_deleted', status: 'success', info: `ID eliminado: ${id}` }
            ]);
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

        const now = TimeService.now();
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

            // 3. Days of week check (prioritize flashDays if it is flash)
            const targetDays = b.isFlash ? b.flashDays : b.daysOfWeek;
            if (targetDays && Array.isArray(targetDays) && targetDays.length > 0 && !targetDays.includes(todayDay)) return false;

            return true;
        });
    },

    // Helper para obtener TODAS las campañas activas por fecha (Catalogo completo)
    async getActiveCampaignsInDateRange() {
        const all = await this.getAll();
        const now = TimeService.now();
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
    },

    async runEngine(trigger: string = 'manual', ignoreDeduplication: boolean = false) {
        try {
            const response = await fetch(`/api/engine-campaigns?trigger=${trigger}&ignoreDeduplication=${ignoreDeduplication}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': (import.meta as any).env.VITE_API_KEY || ''
                }
            });
            if (!response.ok) throw new Error('Error al ejecutar el motor');
            return await response.json();
        } catch (error) {
            console.error('Error running campaign engine:', error);
            throw error;
        }
    }
};
