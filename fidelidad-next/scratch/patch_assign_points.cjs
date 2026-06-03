const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../api/assign-points.js');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'const { uid, reason, amountOverride, amount, concept, metadata, bonusIds, applyWhatsApp, skipNotifications, isPetFood, petIds, date, generateMysteryBox } = req.body || {};',
    'const { uid, reason, amountOverride, amount, concept, metadata, bonusIds, applyWhatsApp, skipNotifications, isPetFood, petIds, isPetLitter, petLitterIds, date, generateMysteryBox } = req.body || {};'
);

// Part 1: clientUpdate logic
const p1Regex = /if \(isPetFood && petIds\.length > 0 && Array\.isArray\(cData\.pets\)\) \{[\s\S]*?\}/;
const p1Replacement = `if (isPetFood && petIds.length > 0 && Array.isArray(cData.pets)) {
                    const todayStr = recordDate.toISOString().split('T')[0];
                    clientUpdate.pets = cData.pets.map(p => {
                        if (petIds.includes(p.id)) {
                            return { ...p, lastPurchaseDate: todayStr, lastFoodAlertDate: null };
                        }
                        return p;
                    });
                }
                
                if (isPetLitter && petLitterIds && petLitterIds.length > 0 && Array.isArray(cData.pets)) {
                    const todayStr = recordDate.toISOString().split('T')[0];
                    clientUpdate.pets = (clientUpdate.pets || cData.pets).map(p => {
                        if (petLitterIds.includes(p.id)) {
                            return { ...p, lastLitterPurchaseDate: todayStr, lastLitterWhatsAppDate: null };
                        }
                        return p;
                    });
                }`;
content = content.replace(p1Regex, p1Replacement);

// Part 2: DB Update logic
const p2Regex = /if \(isPetFood && Array\.isArray\(petIds\) && petIds\.length > 0\) \{[\s\S]*?\} catch \(petErr\) \{\s*\/\/ No bloqueamos la respuesta principal\s*console\.error\('\[assign-points\] Error actualizando pet lastPurchaseDate:', petErr\.message\);\s*\}\s*\}/;

const p2OriginalMatch = content.match(p2Regex);
if (p2OriginalMatch) {
    const p2Replacement = p2OriginalMatch[0] + `

        // 5.7 ACTUALIZAR lastLitterPurchaseDate DE MASCOTAS (Piedras Gato)
        if (isPetLitter && Array.isArray(petLitterIds) && petLitterIds.length > 0) {
            try {
                const userSnap = await db.collection('users').doc(targetUid).get();
                if (userSnap.exists) {
                    const userData = userSnap.data();
                    const purchaseTimestamp = date 
                        ? admin.firestore.Timestamp.fromDate(new Date(date + 'T12:00:00')) 
                        : admin.firestore.FieldValue.serverTimestamp();
                    
                    const nextDate = new Date();
                    const cycle = 15;
                    nextDate.setDate(nextDate.getDate() + cycle);
                    const nextDateStr = nextDate.toISOString().split('T')[0];
                    
                    if (Array.isArray(userData.pets)) {
                        const updatedPets = userData.pets.map(pet => {
                            if (petLitterIds.includes(pet.id)) {
                                return { 
                                    ...pet, 
                                    lastLitterPurchaseDate: purchaseTimestamp,
                                    lastLitterWhatsAppDate: null, 
                                    nextLitterAlertDate: nextDateStr
                                };
                            }
                            return pet;
                        });

                        if (updatedPets.length > 0) {
                            await db.collection('users').doc(targetUid).update({ pets: updatedPets });
                            console.log(\`[assign-points] Pet lastLitterPurchaseDate actualizado para \${petLitterIds.length} mascota(s) del cliente \${targetUid}\`);
                        }
                    }
                }
            } catch (petErr) {
                console.error('[assign-points] Error actualizando pet lastLitterPurchaseDate:', petErr.message);
            }
        }`;
    content = content.replace(p2Regex, p2Replacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched assign-points.js');
