const fs = require('fs');
const path = 'api/engine-daily.js';
let content = fs.readFileSync(path, 'utf8');

// Expiration Warnings
content = content.replace(
    /(\/\/ 1\. PWA PUSH\s+if \(userData\.fcmTokens\?\.length && config\.messaging\?\.pushEnabled !== false\) \{)/,
    `const evChannelsExp = config.messaging?.eventConfigs?.expirationWarning?.channels || ['push', 'email'];
                    const canPushExp = config.messaging?.pushEnabled !== false && evChannelsExp.includes('push');
                    const canEmailExp = config.messaging?.emailEnabled !== false && evChannelsExp.includes('email');
                    const canInboxExp = config.messaging?.inboxEnabled !== false;

                    // 1. PWA PUSH
                    if (userData.fcmTokens?.length && canPushExp) {`
);
content = content.replace(
    /(\/\/ 2\. INBOX\s+if \(config\.messaging\?\.inboxEnabled !== false\) \{)/,
    `// 2. INBOX
                    if (canInboxExp) {`
);
content = content.replace(
    /(\/\/ 3\. EMAIL\s+if \(userData\.email && process\.env\.SMTP_USER && config\.messaging\?\.emailEnabled !== false\) \{)/,
    `// 3. EMAIL
                    if (userData.email && process.env.SMTP_USER && canEmailExp) {`
);

// Pet Food Alert
content = content.replace(
    /(if \(cleanTokens\.length > 0 && config\.messaging\?\.pushEnabled !== false\) \{\s+const PWA_URL = process\.env\.PWA_URL)/,
    `const evChannelsFood = config.messaging?.eventConfigs?.petFoodAlert?.channels || ['push', 'email', 'whatsapp'];
                                const canPushFood = config.messaging?.pushEnabled !== false && evChannelsFood.includes('push');
                                const canEmailFood = config.messaging?.emailEnabled !== false && evChannelsFood.includes('email');
                                const canInboxFood = config.messaging?.inboxEnabled !== false;

                                if (cleanTokens.length > 0 && canPushFood) {
                                    const PWA_URL = process.env.PWA_URL`
);
content = content.replace(
    /(if \(config\.messaging\?\.inboxEnabled !== false\) \{\s+await userDoc\.ref\.collection\('inbox'\)\.add\(\{\s+title: ".*? Aviso de Alimento")/,
    `if (canInboxFood) {
                                    await userDoc.ref.collection('inbox').add({
                                        title: "✅ Aviso de Alimento"` // Note: Emoji parsing might fail, using \u2705 etc or just match start
);
// Fix the inbox replace with regex
content = content.replace(
    /if \(config\.messaging\?\.inboxEnabled !== false\) \{\s+await userDoc\.ref\.collection\('inbox'\)\.add\(\{\s+title: ".*? Aviso de Alimento"/,
    `if (canInboxFood) {
                                    await userDoc.ref.collection('inbox').add({
                                        title: "📦 Aviso de Alimento"` // wait, let's just replace the exact line 
);

// Safer Pet Food Alert replacements:
content = content.replace(
    /if \(config\.messaging\?\.inboxEnabled !== false\) \{\s+await userDoc\.ref\.collection\('inbox'\)\.add\(\{\s+title: "([^"]+Aviso de Alimento)"/,
    `if (canInboxFood) {
                                    await userDoc.ref.collection('inbox').add({
                                        title: "$1"`
);

content = content.replace(
    /if \(userData\.email && process\.env\.SMTP_USER && config\.messaging\?\.emailEnabled !== false\) \{\s+const title = "([^"]+Aviso de Alimento)"/,
    `if (userData.email && process.env.SMTP_USER && canEmailFood) {
                                    const title = "$1"`
);

// Pet Litter Alert
content = content.replace(
    /(if \(cleanTokens\.length > 0 && config\.messaging\?\.pushEnabled !== false\) \{\s+const PWA_URL = process\.env\.PWA_URL.*Aviso de Piedras Sanitarias)/,
    `const evChannelsLitter = config.messaging?.eventConfigs?.petLitterAlert?.channels || ['push', 'email', 'whatsapp'];
                                        const canPushLitter = config.messaging?.pushEnabled !== false && evChannelsLitter.includes('push');
                                        const canEmailLitter = config.messaging?.emailEnabled !== false && evChannelsLitter.includes('email');
                                        const canInboxLitter = config.messaging?.inboxEnabled !== false;

                                        if (cleanTokens.length > 0 && canPushLitter) {
                                            const PWA_URL = process.env.PWA_URL`
);
content = content.replace(
    /if \(config\.messaging\?\.inboxEnabled !== false\) \{\s+await userDoc\.ref\.collection\('inbox'\)\.add\(\{\s+title: "([^"]+Aviso de Piedras Sanitarias)"/,
    `if (canInboxLitter) {
                                            await userDoc.ref.collection('inbox').add({
                                                title: "$1"`
);

content = content.replace(
    /if \(userData\.email && process\.env\.SMTP_USER && config\.messaging\?\.emailEnabled !== false\) \{\s+const title = "([^"]+Aviso de Piedras Sanitarias)"/,
    `if (userData.email && process.env.SMTP_USER && canEmailLitter) {
                                            const title = "$1"`
);


fs.writeFileSync(path, content, 'utf8');
console.log('Replacements done');
