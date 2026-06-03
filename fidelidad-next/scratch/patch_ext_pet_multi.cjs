const fs = require('fs');
const path = require('path');

const contentJsPath = path.join(__dirname, '../extension-club-fidelidad/content.js');
let content = fs.readFileSync(contentJsPath, 'utf8');

content = content.replace(
    /const lastDate = pet\.lastFoodAlertDate;\s*const cycle = Number\(pet\.foodCycleDays\) \|\| 30;\s*let refillText = "";\s*if \(lastDate\) \{\s*const date = new Date\(lastDate \+ 'T12:00:00'\);\s*date\.setDate\(date\.getDate\(\) \+ cycle\);\s*const formatted = date\.toLocaleDateString\('es-AR', \{ day: '2-digit', month: '2-digit' \}\);\s*refillText = ` \(vence \$\{formatted\}\)`;\s*\}/g,
    `const rawLastDate = pet.lastPurchaseDate;
                                    const cycle = Number(pet.frequencyDays) || 30;
                                    let refillText = "";
                                    if (rawLastDate) {
                                        let parsedDate = null;
                                        if (typeof rawLastDate === 'object' && rawLastDate._seconds) {
                                            parsedDate = new Date(rawLastDate._seconds * 1000);
                                        } else {
                                            parsedDate = new Date(rawLastDate + 'T12:00:00');
                                        }
                                        parsedDate.setDate(parsedDate.getDate() + cycle);
                                        const formatted = parsedDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                        refillText = \` (vence \${formatted})\`;
                                    }`
);

fs.writeFileSync(contentJsPath, content, 'utf8');
console.log('Patched content.js multiple pet block');
