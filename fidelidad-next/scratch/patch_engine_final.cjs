const fs = require('fs');
const file = 'api/engine-daily.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the bad block
const badBlockRegex = /const mysteryBoxesList = \[\];[\s\S]*?\} catch \(e\) \{ console\.error\("Error reconstructing mysteryBoxesList:", e\); \}/;
content = content.replace(badBlockRegex, '');

// Fix the return for the skipped block
content = content.replace(/return res\.status\(200\)\.json\(\{[\s\S]*?ok: true, skipped: true, reason \};\}/, 'return res.status(200).json({ ok: true, skipped: true, reason });');

// 2. Insert properly at the end
const properInsertRegex = /return res\.status\(200\)\.json\(\{\s*ok: true,\s*results,/;
const properReplacement = `const mysteryBoxesList = [];
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
            ok: true, 
            results,`;

content = content.replace(properInsertRegex, properReplacement);

fs.writeFileSync(file, content);
console.log('engine-daily fully fixed');
