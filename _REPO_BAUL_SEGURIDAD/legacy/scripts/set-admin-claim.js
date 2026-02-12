/**
 * Script para otorgar permisos de ADMINISTRADOR a un usuario de Firebase.
 * 
 * Uso: node scripts/set-admin-claim.js <email_usuario>
 * 
 * Requisitos:
 * 1. Descargar la clave de cuenta de servicio desde Firebase Console:
 *    Project Settings > Service Accounts > Generate New Private Key
 * 2. Guardar el archivo como "service-account.json" en la raíz del proyecto.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(__dirname, '../service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ ERROR: No se encontró el archivo "service-account.json" en la raíz.');
    console.error('   Por favor, descárgalo desde la consola de Firebase y guárdalo ahí.');
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Inicializar Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const email = process.argv[2];

if (!email) {
    console.error('❌ ERROR: Debes especificar el email del usuario.');
    console.error('   Uso: node scripts/set-admin-claim.js tu-email@ejemplo.com');
    process.exit(1);
}

async function grantAdminRole(email) {
    try {
        const user = await admin.auth().getUserByEmail(email);

        // Otorgar claim { admin: true }
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });

        console.log(`✅ ÉXITO: Se han otorgado permisos de ADMIN al usuario: ${email}`);
        console.log(`ℹ️  El usuario debe cerrar sesión y volver a entrar para que los cambios surtan efecto.`);
        process.exit(0);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error(`❌ ERROR: No existe ningún usuario con el email: ${email}`);
        } else {
            console.error('❌ ERROR:', error);
        }
        process.exit(1);
    }
}

grantAdminRole(email);
