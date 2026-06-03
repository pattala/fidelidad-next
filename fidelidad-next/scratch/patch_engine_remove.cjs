const fs = require('fs');
const file = 'api/engine-daily.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /const mysteryBoxesList = \[\];[\s\S]*?\} catch \(e\) \{ console\.error\("Error reconstructing mysteryBoxesList:", e\); \}/;
// Replace the first occurrence (which is the one inside the `if`)
content = content.replace(regex, '');
// And the second occurrence? Wait, maybe I'll replace ALL occurrences and then insert it exactly where it belongs.
content = content.replace(new RegExp(regex, 'g'), '');

// Now, let's insert it exactly at the end.
const finalRegex = /return res\.status\(200\)\.json\(\{[\s\S]*?ok: true,/;

const replacement = `const mysteryBoxesList = [];
        try {
            const mbSnapshot = await db.collection('mystery_box_chances').where('status', '==', 'pending').get();
            mbSnapshot.docs.forEach(doc => {
                const data = doc.data();
                mysteryBoxesList.push({
                    id: doc.id,
                    alertId: 'mb_' + doc.id,
                    userId: data.userId,
                    userName: data.userName || 'Socio',
                    socioNumber: data.socioNumber || '',
                    phone: data.phone || '',
                    amount: data.amount || 0,
                    createdAt: data.createdAt,
                    expiresAt: data.expiresAt,
                    status: data.status || 'pending',
                    type: 'mysteryBox'
                });
            });
        } catch (e) { console.error("Error reconstructing mysteryBoxesList:", e); }

        return res.status(200).json({
            ok: true,`;

content = content.replace(finalRegex, replacement);

fs.writeFileSync(file, content);
console.log('cleaned and patched engine-daily.js');
