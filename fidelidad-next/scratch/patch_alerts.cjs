const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/modules/admin/components/GlobalAlerts.tsx');
let content = fs.readFileSync(file, 'utf8');

// Patch 1: Add petLitter logic inside data.pets.forEach
const regex1 = /if \(isAlertWindow && !waSent\) \{\s*pets\.push\(\{\s*\.\.\.data, petName: p\.name, foodBrand: p\.foodBrand \|\| p\.brand \|\| '', alertId: pId, id: d\.id\s*\}\);\s*\}/;

const replacement1 = `if (isAlertWindow && !waSent) {
                                    pets.push({ ...data, petName: p.name, foodBrand: p.foodBrand || p.brand || '', alertId: pId, id: d.id, alertType: 'food' });
                                }
                                
                                // Lógica para Piedras Sanitarias (solo gatos)
                                if ((p.type || '').toLowerCase().trim() === 'gato') {
                                    const lastLitterPurchase = p.lastLitterPurchaseDate?.toDate ? p.lastLitterPurchaseDate.toDate() : (p.lastLitterPurchaseDate ? new Date(p.lastLitterPurchaseDate + 'T12:00:00') : null);
                                    if (lastLitterPurchase) {
                                        const litterCycleDays = Number(p.litterFrequencyDays || 15);
                                        const warningDays = Number(config?.messaging?.petFoodWarningDays || config?.petFoodAlertLeadDays || 3);
                                        
                                        const litterExhaustionDate = new Date(lastLitterPurchase);
                                        litterExhaustionDate.setDate(lastLitterPurchase.getDate() + litterCycleDays);
                                        
                                        const litterAlertDate = new Date(litterExhaustionDate);
                                        litterAlertDate.setDate(litterExhaustionDate.getDate() - warningDays);
                                        
                                        const isLitterAlertWindow = (todayDate >= litterAlertDate && todayDate <= litterExhaustionDate);
                                        
                                        const lastLitterWa = p.lastLitterWhatsAppDate ? new Date(p.lastLitterWhatsAppDate + 'T12:00:00') : null;
                                        const litterWaSent = lastLitterWa && lastLitterWa >= lastLitterPurchase;
                                        
                                        if (isLitterAlertWindow && !litterWaSent) {
                                            const litterPId = \`litter-\${userIdentifier}-\${p.name}-\${p.nextLitterAlertDate || 'today'}\`;
                                            pets.push({ ...data, petName: p.name, alertId: litterPId, id: d.id, alertType: 'litter' });
                                        }
                                    }
                                }`;

content = content.replace(regex1, replacement1);

// Patch 2: Add petLitter whatsapp template logic
const regex2 = /} else \{\s*const tpl = config\.messaging\?\.templates\?\.whatsappPetFood \|\| '¡Hola \{nombre\}! 🐾 Notamos que a \{mascota\} se le debe estar terminando su alimento Marca: \{marca\}\.';\s*msg = tpl\.replace\(\/\{nombre\}\/g, firstName\)\.replace\(\/\{mascota\}\/g, item\.petName \|\| ''\)\.replace\(\/\{marca\}\/g, item\.foodBrand \|\| ''\);\s*\/\/ Actualizar lastWhatsAppDate en Firestore para que no vuelva a aparecer mañana\s*if \(item\.id && item\.pets\) \{\s*const userRef = doc\(db, 'users', item\.id\);\s*const updatedPets = item\.pets\.map\(\(p: any\) => \{\s*if \(p\.name === item\.petName\) \{\s*return \{ \.\.\.p, lastWhatsAppDate: todayStr \};\s*\}\s*return p;\s*\}\);\s*updateDoc\(userRef, \{ pets: updatedPets \}\)\.catch\(e => console\.error\("Error updating pet wa date:", e\)\);\s*\}\s*\}/;

const replacement2 = `} else if (item.alertType === 'litter') {
                    const tpl = '¡Hola {nombre}! 🐾 Notamos que a {mascota} se le deben estar terminando sus piedras sanitarias.';
                    msg = tpl.replace(/{nombre}/g, firstName).replace(/{mascota}/g, item.petName || '');
                    
                    if (item.id && item.pets) {
                        const userRef = doc(db, 'users', item.id);
                        const updatedPets = item.pets.map((p: any) => {
                            if (p.name === item.petName) {
                                return { ...p, lastLitterWhatsAppDate: todayStr };
                            }
                            return p;
                        });
                        updateDoc(userRef, { pets: updatedPets }).catch(e => console.error("Error updating pet litter wa date:", e));
                    }
                } else {
                    const tpl = config.messaging?.templates?.whatsappPetFood || '¡Hola {nombre}! 🐾 Notamos que a {mascota} se le debe estar terminando su alimento Marca: {marca}.';
                    msg = tpl.replace(/{nombre}/g, firstName).replace(/{mascota}/g, item.petName || '').replace(/{marca}/g, item.foodBrand || '');
                    
                    if (item.id && item.pets) {
                        const userRef = doc(db, 'users', item.id);
                        const updatedPets = item.pets.map((p: any) => {
                            if (p.name === item.petName) {
                                return { ...p, lastWhatsAppDate: todayStr };
                            }
                            return p;
                        });
                        updateDoc(userRef, { pets: updatedPets }).catch(e => console.error("Error updating pet wa date:", e));
                    }
                }`;

content = content.replace(regex2, replacement2);

// Patch 3: Render text for litter alert
const regex3 = /<span className="font-bold">\{alert\.petName\}<\/span>\s*<span className="text-\[10px\] opacity-80 uppercase bg-white\/20 px-1\.5 rounded truncate">\{alert\.foodBrand\}<\/span>/;
const replacement3 = `{alert.alertType === 'litter' ? (
                                                        <>
                                                            <span className="font-bold">{alert.petName}</span>
                                                            <span className="text-[10px] opacity-80 uppercase bg-white/20 px-1.5 rounded truncate">Piedras Sanitarias</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="font-bold">{alert.petName}</span>
                                                            <span className="text-[10px] opacity-80 uppercase bg-white/20 px-1.5 rounded truncate">{alert.foodBrand}</span>
                                                        </>
                                                    )}`;
content = content.replace(regex3, replacement3);


fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched GlobalAlerts.tsx');
