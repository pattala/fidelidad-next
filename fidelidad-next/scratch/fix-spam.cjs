const fs = require("fs");

let engine = fs.readFileSync("api/engine-campaigns.js", "utf8");

// 1. Delete empty audit logs instead of updating them
engine = engine.replace(
`        // V.1.6.4: Actualizar auditoría con éxito al finalizar
        if (auditLogRef) {
            await auditLogRef.update({
                status: 'success',
                summary: \`Motor de campañas finalizado: \${results.notified} difusiones, \${results.deactivated} desactivadas.\`,
                details: [results]
            });
        }`,
`        // V.1.6.4: Actualizar auditoría con éxito al finalizar
        if (auditLogRef) {
            if (results.notified === 0 && results.deactivated === 0 && triggerSource !== 'manual') {
                await auditLogRef.delete();
            } else {
                await auditLogRef.update({
                    status: 'success',
                    summary: \`Motor de campañas finalizado: \${results.notified} difusiones, \${results.deactivated} desactivadas.\`,
                    details: [results]
                });
            }
        }`
);

// 2. Add users to the details array for campaign_broadcasted and results
engine = engine.replace(
`                    results.details.push({ id: campId, name: camp.name, tokens: fcmTokens.length });`,
`                    const affected = userDocs.map(u => ({ id: u.id, name: u.data.name || u.data.nombre || 'Socio', email: u.data.email }));
                    results.details.push({ id: campId, name: camp.name, tokens: fcmTokens.length, users: affected });`
);

engine = engine.replace(
`action: 'campaign_broadcasted', campName: camp.name, timestamp: now.toISOString() }],`,
`action: 'campaign_broadcasted', campName: camp.name, timestamp: now.toISOString(), affectedUsers: affected }],`
);

fs.writeFileSync("api/engine-campaigns.js", engine);

// 3. Change 10s ping to 60s ping in ClientHomePage.tsx
let client = fs.readFileSync("src/modules/client/pages/ClientHomePage.tsx", "utf8");
client = client.replace(/\}, 10000\);/g, "}, 60000);");
fs.writeFileSync("src/modules/client/pages/ClientHomePage.tsx", client);

let config = fs.readFileSync("src/lib/adminConfig.ts", "utf8");
config = config.replace(/APP_VERSION = 'V\.1\.6\.9'/g, "APP_VERSION = 'V.1.6.10'");
fs.writeFileSync("src/lib/adminConfig.ts", config);

console.log("Patched engine logs and ping interval.");
