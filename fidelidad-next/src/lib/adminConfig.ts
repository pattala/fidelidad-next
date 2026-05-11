/**
 * APP VERSION & REVISION
 */
export const APP_VERSION = 'V.1.4.60';

/**
 * CONFIGURACIÓN DE SEGURIDAD ADMINISTRATIVA (White Label)
 * El sistema es autoinstalable. Si no hay admins en Firestore, 
 * se permite el acceso inicial con credenciales de fábrica.
 */

export const DEFAULT_ADMIN = {
    email: 'admin@admin.com',
    pass: 'adminadmin'
};

export const MASTER_ADMINS = [
    'pablo_attala@yahoo.com.ar',
    'admin@admin.com',
];

export const MASTER_LOGIN_KEY = import.meta.env.VITE_MASTER_LOGIN_KEY || 'Felipe01';
export const DEFAULT_ADMIN_KEY = 'adminadmin';

export const isMasterAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return MASTER_ADMINS.includes(email.toLowerCase());
};
