const fs = require('fs');
const path = 'api/users.js';
let content = fs.readFileSync(path, 'utf8');

// The replacement for Inbox message:
content = content.replace(
    /(const inboxRef = clienteRef\.collection\('inbox'\)\.doc\(`welcome_\$\{docId\}`\);\s+batch\.set\(inboxRef, \{[\s\S]*?expireAt: admin\.firestore\.Timestamp\.fromDate\(new Date\(now\.getTime\(\) \+ 7776000000\)\)\s+\}\);)/,
    `// Inbox: mensaje de bienvenida (siempre, con o sin puntos)
            const messagingCfg = config.messaging || {};
            const evChannelsWelcome = messagingCfg.eventConfigs?.welcome?.channels || ['email', 'push'];
            const canEmailWelcome = messagingCfg.emailEnabled !== false && evChannelsWelcome.includes('email');
            const canInboxWelcome = messagingCfg.inboxEnabled !== false;
            const canWhatsAppWelcome = messagingCfg.whatsappEnabled !== false && evChannelsWelcome.includes('whatsapp');

            let waWelcomeMsg = "";
            if (canWhatsAppWelcome) {
                let wTmpl = messagingCfg.templates?.welcome_whatsapp || messagingCfg.templates?.welcome || "¡Bienvenido a {siteName}! Tu nro de socio es #{numero_socio}.";
                waWelcomeMsg = wTmpl
                    .replace(/{nombre}/g, userName)
                    .replace(/{siteName}/g, siteName)
                    .replace(/{numero_socio}/g, assignedNumber)
                    .replace(/{puntos}/g, totalBonus);
            }

            if (canInboxWelcome) {
                const inboxRef = clienteRef.collection('inbox').doc(\`welcome_\${docId}\`);
                batch.set(inboxRef, {
                    title: \`🎉 ¡Bienvenido/a a \${siteName}! 🎉\`,
                    body: totalBonus > 0
                        ? \`Tu cuenta fue creada con éxito. Número de socio: #\${assignedNumber}. ¡Recibiste \${totalBonus} puntos de bienvenida que vencen el \${expirationDateStr}!\`
                        : \`Tu cuenta fue creada con éxito. Número de socio: #\${assignedNumber}. ¡Ya podés empezar a acumular puntos!\`,
                    url: '/', type: 'welcome', read: false,
                    date: admin.firestore.FieldValue.serverTimestamp(),
                    expireAt: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 7776000000))
                });
            }`
);

// The replacement for Email
content = content.replace(
    /(\/\/ 4\. Enviar email de bienvenida con datos correctos\s+if \(userEmail\) \{)/,
    `// 4. Enviar email de bienvenida condicionado a la configuración maestra
            if (userEmail && canEmailWelcome) {`
);

// We must also modify the return statement to include whatsappMsg if available
content = content.replace(
    /return res\.status\(200\)\.json\(\{ ok: true, numeroSocio: assignedNumber \}\);/,
    `return res.status(200).json({ ok: true, numeroSocio: assignedNumber, whatsappMsg: waWelcomeMsg || undefined });`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Users replaced');
