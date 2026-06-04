const fs = require('fs');

// Update adminConfig.ts
let config = fs.readFileSync('src/lib/adminConfig.ts', 'utf8');
config = config.replace(/APP_VERSION = 'V\.1\.6\.26'/g, "APP_VERSION = 'V.1.6.27'");
fs.writeFileSync('src/lib/adminConfig.ts', config);

// Update ClientProfilePage.tsx
let profile = fs.readFileSync('src/modules/client/pages/ClientProfilePage.tsx', 'utf8');
profile = profile.replace(/App V1\.6\.26/g, "App V1.6.27");
fs.writeFileSync('src/modules/client/pages/ClientProfilePage.tsx', profile);

console.log("Updated version strings to V1.6.27");
