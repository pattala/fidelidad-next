import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type AuditAction =
    | 'prize_created' | 'prize_updated' | 'prize_deleted'
    | 'campaign_created' | 'campaign_updated' | 'campaign_deleted'
    | 'config_updated'
    | 'admin_invited'
    | 'socio_number_assigned';

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
