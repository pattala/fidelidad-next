/**
 * CONFIGURACIÓN DE SEGURIDAD ADMINISTRATIVA
 * Centraliza los correos electrónicos con acceso total (Administradores Maestros).
 */
export const MASTER_ADMINS = [
    'pablo_attala@yahoo.com.ar',
    // 'otro_admin@ejemplo.com', // Puedes agregar más aquí
];

/**
 * Función auxiliar para verificar si un email es admin maestro
 */
export const isMasterAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return MASTER_ADMINS.includes(email.toLowerCase());
};
