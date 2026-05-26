const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../api/engine-campaigns.js');
let content = fs.readFileSync(filePath, 'utf8');

const oldLogic = `                    // 1. ENVIAR PUSH (V.1.6.6: Ajustado a data-only para evitar que Chrome bypasee el Service Worker)
                    if (config.messaging?.pushEnabled !== false) {
                        const allTokens = [];
                        userDocs.forEach(u => {
                            const valid = (u.data.fcmTokens || []).map(t => typeof t === 'object' && t !== null ? t.token : t).filter((t) => t && typeof t === 'string' && t.length > 10) || [];
                            allTokens.push(...valid);
                        });

                        if (allTokens.length > 0) {
                            // Reemplazar {nombre} por "Socio" para el envo masivo (multicast)
                            const pushBody = body.replace(/{nombre}/g, 'Socio');
                            
                            const chunks = [];
                            for (let i = 0; i < allTokens.length; i += 500) chunks.push(allTokens.slice(i, i + 500));
                            
                            for (const chunk of chunks) {
                                try {
                                    // IMPORTANTE: Se usa SOLO el campo 'data' (sin 'notification' top-level)
                                    // para asegurar que el SW siempre procese la notificacin en segundo plano.
                                    await app.messaging().sendEachForMulticast({
                                        tokens: chunk,
                                        data: { 
                                            id: db.collection("_ids").doc().id,
                                            title, 
                                            body: pushBody, 
                                            url, 
                                            click_action: url,
                                            type: "campaign", 
                                            icon: iconUrl,
                                            badge: iconUrl
                                        },
                                        notification: { title, body: pushBody },
                                        android: { 
                                            priority: "high",
                                            notification: {
                                                sound: "default",
                                                channelId: "fidelidad-notif-channel"
                                            }
                                        },
                                        webpush: { 
                                            headers: { Urgent: "high" },
                                            fcmOptions: { link: \`\${PWA_URL}\${url.startsWith('/') ? url : '/' + url}\` } 
                                        }
                                    });
                                    console.log(\`[Engine-Campaigns] Push batch sent (data-only).\`);
                                } catch (pError) {
                                    console.error("[Engine-Campaigns] Push chunk error:", pError.message);
                                }
                            }
                        }
                    }`;

const newLogic = `                    // 1. ENVIAR PUSH INDIVIDUALIZADO (Soporte para {nombre})
                    if (config.messaging?.pushEnabled !== false) {
                        const messages = [];
                        userDocs.forEach(u => {
                            const validTokens = (u.data.fcmTokens || []).map(t => typeof t === 'object' && t !== null ? t.token : t).filter((t) => t && typeof t === 'string' && t.length > 10) || [];
                            
                            // Personalizar para cada socio
                            const personalizedBody = body.replace(/{nombre}/g, u.data.name || u.data.nombre || 'Socio');
                            
                            validTokens.forEach(token => {
                                messages.push({
                                    token: token,
                                    data: { 
                                        id: db.collection("_ids").doc().id,
                                        title, 
                                        body: personalizedBody, 
                                        url, 
                                        click_action: url,
                                        type: "campaign", 
                                        icon: iconUrl,
                                        badge: iconUrl
                                    },
                                    notification: { title, body: personalizedBody },
                                    android: { 
                                        priority: "high",
                                        notification: {
                                            sound: "default",
                                            channelId: "fidelidad-notif-channel"
                                        }
                                    },
                                    webpush: { 
                                        headers: { Urgent: "high" },
                                        fcmOptions: { link: \`\${PWA_URL}\${url.startsWith('/') ? url : '/' + url}\` } 
                                    }
                                });
                            });
                        });

                        if (messages.length > 0) {
                            const chunks = [];
                            for (let i = 0; i < messages.length; i += 500) chunks.push(messages.slice(i, i + 500));
                            
                            for (const chunk of chunks) {
                                try {
                                    await app.messaging().sendEach(chunk);
                                    console.log(\`[Engine-Campaigns] Push batch sent with \${chunk.length} personalized messages.\`);
                                } catch (pError) {
                                    console.error("[Engine-Campaigns] Push chunk error:", pError.message);
                                }
                            }
                        }
                    }`;

// For oldLogic, replace the "" characters because node reads it weirdly if it's UTF-8 and file is ANSI or vice-versa. Let's use regex matching to be safe.
const oldLogicRegex = /\/\/\s*1\.\s*ENVIAR PUSH[\s\S]*?console\.error\("\[Engine-Campaigns\] Push chunk error:",\s*pError\.message\);\s*\}\s*\}\s*\}\s*\}/g;

const match = content.match(oldLogicRegex);
if (!match) {
    console.error("Could not find the target block using regex!");
} else {
    content = content.replace(oldLogicRegex, newLogic);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Patched engine-campaigns.js push logic successfully.");
}
