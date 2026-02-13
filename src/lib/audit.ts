import { supabase } from './supabase';
import toast from 'react-hot-toast';

export interface AuditLog {
    id?: string;
    created_at?: string;
    user_id: string;
    user_name: string;
    action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN';
    entity_type: 'STOCK_MOVEMENT' | 'NEEDS_REQUEST' | 'PRODUCT' | 'USER' | 'CATEGORY';
    entity_id: string;
    site?: string;
    reason?: string;
    details?: any;
}

export const logAudit = async (action: Omit<AuditLog, 'user_id' | 'user_name'>, profile: any) => {
    if (!profile?.id) {
        console.warn('Audit skip: No profile ID provided');
        return;
    }

    try {
        const { reason, ...rest } = action;

        // Ensure reason is always in details as a backup
        const details = {
            ...action.details,
            ...(reason ? { motive: reason } : {})
        };

        const payload: any = {
            ...rest,
            details,
            user_id: profile.id,
            user_name: profile.full_name || profile.username || 'System',
            created_at: new Date().toISOString(),
        };

        // Try to include reason column if it exists
        if (reason) {
            payload.reason = reason;
        }

        const { error } = await supabase.from('audit_logs').insert([payload]);

        if (error) {
            // Check for specific Postgres error code 42703 (undefined_column) or generic 400 with 'reason'
            const isMissingColumn = error.code === '42703' || (error.message && error.message.includes('reason'));

            if (isMissingColumn && payload.reason) {
                console.warn('Audit logs: Colonne "reason" absente. Repli vers "details" uniquement.');
                const { reason, ...safePayload } = payload;
                const { error: retryError } = await supabase.from('audit_logs').insert([safePayload]);

                if (retryError) {
                    console.error('Audit retry failed:', retryError);
                    toast.error("Erreur critique d'audit");
                }
            } else {
                console.error('Audit log failed:', error);
                // Si l'erreur est liée au profil ou à la session
                if (error.code === '42501') {
                    toast.error("Audit : Permission refusée");
                } else {
                    toast.error(`Échec Audit: ${error.message || 'Erreur inconnue'}`);
                }
            }
        }
    } catch (err) {
        console.error('Audit log exception:', err);
    }
};
