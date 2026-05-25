const fs = require("fs");

let engine = fs.readFileSync("api/engine-campaigns.js", "utf8");

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

engine = engine.replace(/\/\/ Auditor[^\n]+WhatsApp[\s\S]+?executor: 'system'\n\s+\}\);/, auditReplace);

fs.writeFileSync("api/engine-campaigns.js", engine);
console.log("Patched api/engine-campaigns.js");
