const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../api/engine-daily.js');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const mysteryBoxesList = [];')) {
    const patchCode = `
        const petAlertsList = [];
        try {
            const usersWithPets = await db.collection('users').get();
            usersWithPets.docs.forEach(doc => {
                const userData = doc.data();
                if (!activeUserIds.has(doc.id)) return;
                // ... logic is inside checkPets and duplicate down below... 
`;
    // Actually, let's insert it before line 1030 (the return statement).
    content = content.replace(
        'return res.status(200).json({',
        `const mysteryBoxesList = [];
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

        return res.status(200).json({`
    );

    content = content.replace(
        'petAlerts: petAlertsList,',
        'petAlerts: petAlertsList,\n            mysteryBoxes: mysteryBoxesList,'
    );
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('engine-daily patched to include mysteryBoxesList');
} else {
    console.log('already patched');
}
