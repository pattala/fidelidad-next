const fs = require('fs');
const file = 'api/engine-daily.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /return res\.status\(200\)\.json\(\{[\s\S]*?ok: true,/;

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

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('patched engine-daily.js');
