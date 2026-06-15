const fs = require('fs');
const path = 'api/engine-daily.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /(\/\/ 1\. PWA PUSH\s+if \(userData\.fcmTokens\?\.length && config\.messaging\?\.pushEnabled !== false\) \{)/,
    `const evChannelsBday = config.messaging?.eventConfigs?.birthday?.channels || ['push', 'email'];
                          const canPushBday = config.messaging?.pushEnabled !== false && evChannelsBday.includes('push');
                          const canEmailBday = config.messaging?.emailEnabled !== false && evChannelsBday.includes('email');
                          const canInboxBday = config.messaging?.inboxEnabled !== false;
                          
                          // 1. PWA PUSH
                          if (userData.fcmTokens?.length && canPushBday) {`
);

content = content.replace(
    /(\/\/ 2\. INBOX\s+if \(config\.messaging\?\.inboxEnabled !== false\) \{)/,
    `// 2. INBOX
                          if (canInboxBday) {`
);

content = content.replace(
    /(\/\/ 3\. EMAIL\s+if \(userData\.email && process\.env\.SMTP_USER && config\.messaging\?\.emailEnabled !== false\) \{)/,
    `// 3. EMAIL
                          if (userData.email && process.env.SMTP_USER && canEmailBday) {`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Bday replaced');
