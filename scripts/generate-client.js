const fs = require('fs');
const path = require('path');

// Obtener el ID del cliente desde los argumentos (por defecto 'rampet')
const args = process.argv.slice(2);
const clientArg = args.find(arg => arg.startsWith('--client='));
const clientId = clientArg ? clientArg.split('=')[1] : 'rampet';

const clientsDir = path.join(__dirname, '../clients');
const clientFile = path.join(clientsDir, `${clientId}.json`);

if (!fs.existsSync(clientFile)) {
    console.error(`❌ Error: No se encontró la configuración para el cliente '${clientId}' en ${clientFile}`);
    process.exit(1);
}

console.log(`🚀 Generando configuración para: ${clientId}...`);
const clientConfig = JSON.parse(fs.readFileSync(clientFile, 'utf8'));

// ------------------------------------------------------------------
// 1. Generar client-pwa/config.js
// ------------------------------------------------------------------
const pwaConfigContent = `// Configuración Global - Generada automáticamente
// Cliente: ${clientConfig.appName}
// Fecha: ${new Date().toISOString()}

window.APP_CONFIG = {
    appName: "${clientConfig.appName}",
    companyName: "${clientConfig.companyName}",
    logoUrl: "${clientConfig.logoUrl}",
    apiUrl: "${clientConfig.apiUrl || ''}",
    
    theme: ${JSON.stringify(clientConfig.theme, null, 4)},
    
    features: ${JSON.stringify(clientConfig.features, null, 4)},
    
    // VAPID para Web Push
    vapidPublic: "${clientConfig.vapidPublic}",

    // Configuración de Firebase
    firebaseConfig: ${JSON.stringify(clientConfig.firebase, null, 4)}
};
`;

const pwaConfigPath = path.join(__dirname, '../client-pwa/config.js');
fs.writeFileSync(pwaConfigPath, pwaConfigContent);
console.log(`✅ client-pwa/config.js generado.`);

// ------------------------------------------------------------------
// 2. Generar client-pwa/manifest.json
// ------------------------------------------------------------------
const manifestContent = {
    short_name: clientConfig.shortName || clientConfig.appName,
    name: clientConfig.appName,
    description: clientConfig.description,
    start_url: clientConfig.pwa.startUrl,
    scope: clientConfig.pwa.scope,
    display: clientConfig.pwa.display,
    theme_color: clientConfig.theme.primary,
    background_color: clientConfig.theme.background,
    icons: clientConfig.pwa.icons,
    gcm_sender_id: clientConfig.pwa.gcmSenderId
};

const manifestPath = path.join(__dirname, '../client-pwa/manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
console.log(`✅ client-pwa/manifest.json generado.`);

// ------------------------------------------------------------------
// 3. Generar admin-panel/config.js
// ------------------------------------------------------------------
const adminConfigContent = `// Configuración Global Admin - Generada automáticamente
// Cliente: ${clientConfig.appName}

window.ADMIN_CONFIG = {
    platformName: "Admin - ${clientConfig.appName}",
    logoUrl: "${clientConfig.logoUrl}",
    apiUrl: "${clientConfig.apiUrl || 'https://fidelidad-api.vercel.app'}",
    apiKey: "${process.env.API_SECRET_KEY || ''}",
    
    theme: ${JSON.stringify(clientConfig.theme, null, 4)},

    featureFlags: ${JSON.stringify(clientConfig.featureFlags || {}, null, 4)},

    // Configuración de Firebase compartida
    firebaseConfig: ${JSON.stringify(clientConfig.firebase, null, 4)}
};
`;

const adminConfigPath = path.join(__dirname, '../admin-panel/config.js');
fs.writeFileSync(adminConfigPath, adminConfigContent);
console.log(`✅ admin-panel/config.js generado.`);

console.log(`\n✨ Configuración aplicada exitosamente para ${clientId}.`);
