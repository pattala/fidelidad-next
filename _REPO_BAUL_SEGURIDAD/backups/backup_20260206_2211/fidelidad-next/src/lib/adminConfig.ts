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
];

export const isMasterAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return MASTER_ADMINS.includes(email.toLowerCase());
};
