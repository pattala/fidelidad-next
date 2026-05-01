import { auth } from '../lib/firebase';

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
            const token = await user?.getIdToken();
            const executor = user?.email || user?.uid || 'admin';

            await fetch('/api/log-audit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // @ts-ignore
                    'x-api-key': import.meta.env.VITE_API_KEY || '',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type,
                    status: 'success',
                    summary,
                    details,
                    executor
                })
            });
        } catch (error) {
            console.error('Error logging audit via API:', error);
        }
    }
};
