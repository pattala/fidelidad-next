import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type AuditAction =
    | 'prize_created' | 'prize_updated' | 'prize_deleted'
    | 'campaign_created' | 'campaign_updated' | 'campaign_deleted' | 'campaign_mgmt' | 'campaign_diffusion'
    | 'config_updated'
    | 'admin_invited'
    | 'socio_number_assigned'
    | 'user_mgmt' | 'user_updated_profile' | 'data_export' | 'points_assignment' | 'prizes_redemption';

export const AuditService = {
    log: async (type: string, summary: string, details: any[] = []) => {
        try {
            const user = auth.currentUser;
            const executor = user?.email || user?.uid || 'admin';

            await addDoc(collection(db, 'audit_logs'), {
                timestamp: serverTimestamp(),
                type,
                status: 'success',
                summary,
                details,
                executor
            });
        } catch (error) {
            console.error('Error logging audit from frontend:', error);
        }
    }
};
