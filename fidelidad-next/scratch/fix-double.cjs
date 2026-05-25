const fs = require("fs");
let engine = fs.readFileSync("api/engine-campaigns.js", "utf8");

// Move broadcastSentAt update before sending push
engine = engine.replace(/\/\/ 3\. ACTUALIZAR MARCA DE ENVÍO\s*await doc\.ref\.update\(\{ broadcastSentAt: todayStr \}\);\s*results\.notified\+\+;\s*results\.details\.push\(\{ id: campId, name: camp\.name, tokens: fcmTokens\.length \}\);/g, `results.notified++;
                    results.details.push({ id: campId, name: camp.name, tokens: fcmTokens.length });`);

engine = engine.replace(/try \{\s*\/\/ 1\. ENVIAR PUSH/g, `try {
                    // 0. ACTUALIZAR MARCA DE ENVÍO PREVENTIVAMENTE PARA EVITAR RACE CONDITIONS (Doble Push)
                    await doc.ref.update({ broadcastSentAt: todayStr });

                    // 1. ENVIAR PUSH`);

fs.writeFileSync("api/engine-campaigns.js", engine);

let client = fs.readFileSync("src/modules/client/pages/ClientHomePage.tsx", "utf8");
client = client.replace(/if \(config\?\.messaging\?\.enableClientTrigger !== false\) \{/g, `if (config?.messaging?.enableClientTrigger !== false && !window.__enginePinging) {
                window.__enginePinging = true;`);
client = client.replace(/fetch\('\/api\/engine-campaigns\?trigger=pwa'(.*)\)\.catch\(\(\) => \{\}\);/g, `fetch('/api/engine-campaigns?trigger=pwa'$1).finally(() => { window.__enginePinging = false; }).catch(() => {});`);
fs.writeFileSync("src/modules/client/pages/ClientHomePage.tsx", client);

let configTS = fs.readFileSync("src/lib/adminConfig.ts", "utf8");
configTS = configTS.replace(/APP_VERSION = 'V\.1\.6\.8'/g, "APP_VERSION = 'V.1.6.9'");
fs.writeFileSync("src/lib/adminConfig.ts", configTS);

console.log("Patched race condition");
