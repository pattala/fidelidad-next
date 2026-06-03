const fs = require('fs');

const file = 'api/sync-alerts.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/type: 'daily_alerts_sync'\s*},\s*\{\s*merge:\s*true\s*\}\);/, `type: 'daily_alerts_sync' }, { merge: true });

            if (alertId && alertId.startsWith('mb_')) {
                const mbId = alertId.substring(3);
                const mbRef = db.collection('mystery_box_chances').doc(mbId);
                transaction.set(mbRef, { status: 'resolved' }, { merge: true });
            }`);

fs.writeFileSync(file, c);
console.log("Patched sync-alerts.js");
