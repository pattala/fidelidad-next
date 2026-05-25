const fs = require("fs");

let engine = fs.readFileSync("api/engine-campaigns.js", "utf8");

// 1. Bypass global time restriction for Flash campaigns
engine = engine.replace(
    /if \(!isManualSim && \(currentHour < globalStartH \|\| currentHour >= globalEndH\)\) \{/,
    "if (!isManualSim && !camp.isFlash && (currentHour < globalStartH || currentHour >= globalEndH)) {"
);

// 2. Add users to the details array and create a campaign_whatsapp_csv log
const auditReplace = `// Auditoría + Recordatorio de WhatsApp
                    const affected = userDocs.map(u => ({ id: u.id, name: u.data.name || u.data.nombre || 'Socio', email: u.data.email }));
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.Timestamp.fromDate(now),
                        type: 'campaign_broadcast',
                        status: 'success',
                        summary: \`Difusión automática: \${camp.name}\`,
                        details: [{ campId, notifiedCount: fcmTokens.length, userCount: userDocs.length, affectedUsers: affected, title, trigger: req.query.trigger || 'auto', action: 'campaign_broadcasted', campName: camp.name, timestamp: now.toISOString() }],
                        executor: 'system'
                    });
                    
                    // Alerta específica para generar el CSV en el Dashboard
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.Timestamp.fromDate(now),
                        type: 'campaign_whatsapp_csv',
                        status: 'success',
                        summary: \`Generación de CSV para WhatsApp pendiente: \${camp.name}\`,
                        details: [{ action: 'csv_downloaded', campaignId: campId }],
                        executor: 'system'
                    });`;

engine = engine.replace(/\/\/ Auditora \+ Recordatorio de WhatsApp[\s\S]+?executor: 'system'\n\s+\}\);/, auditReplace);

fs.writeFileSync("api/engine-campaigns.js", engine);


// 3. ClientHomePage.tsx ping removal
let clientHome = fs.readFileSync("src/modules/client/pages/ClientHomePage.tsx", "utf8");
clientHome = clientHome.replace(
    /const interval = setInterval\(\(\) => \{[\s\S]+?\}, 10000\);/,
    "const interval = setInterval(() => { setCurrentTimeStore(TimeService.now()); }, 10000);"
);
fs.writeFileSync("src/modules/client/pages/ClientHomePage.tsx", clientHome);


// 4. CampaignsPage.tsx redirect removal
let campPage = fs.readFileSync("src/modules/admin/pages/CampaignsPage.tsx", "utf8");
campPage = campPage.replace(
    /\/\/ 2\. Redirigir a la cola interactiva interna precargando mensaje y clientes[\s\S]+?\}, 1500\);/,
    "// 2. Se eliminó la redirección a la cola iterativa para facilitar el uso exclusivo de CSV masivo."
);
fs.writeFileSync("src/modules/admin/pages/CampaignsPage.tsx", campPage);

// 5. Update Version
let config = fs.readFileSync("src/lib/adminConfig.ts", "utf8");
config = config.replace(/APP_VERSION = 'V\.1\.6\.9'/g, "APP_VERSION = 'V.1.6.10'");
fs.writeFileSync("src/lib/adminConfig.ts", config);

console.log("All patches applied.");
