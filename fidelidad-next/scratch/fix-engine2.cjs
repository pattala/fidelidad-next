const fs = require("fs");
let engine = fs.readFileSync("api/engine-campaigns.js", "utf8");

const parts = engine.split("results.details.push({ id: campId, name: camp.name, tokens: fcmTokens.length });");
if (parts.length === 2) {
    const after = parts[1];
    const newAfter = after.replace(/await db\.collection\('audit_logs'\)\.add\(\{[\s\S]+?\}\);/, `const affected = userDocs.map(u => ({ id: u.id, name: u.data.name || u.data.nombre || 'Socio', email: u.data.email }));
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
                    });`);
    engine = parts[0] + "results.details.push({ id: campId, name: camp.name, tokens: fcmTokens.length });" + newAfter;
    
    // Bypass global logic
    engine = engine.replace(
        "if (!isManualSim && (currentHour < globalStartH || currentHour >= globalEndH)) {",
        "if (!isManualSim && !camp.isFlash && (currentHour < globalStartH || currentHour >= globalEndH)) {"
    );

    fs.writeFileSync("api/engine-campaigns.js", engine);
    console.log("Patched successfully!");
} else {
    console.log("Could not split engine-campaigns.js");
}
