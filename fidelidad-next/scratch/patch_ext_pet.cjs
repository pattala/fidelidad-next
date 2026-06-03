const fs = require('fs');
const path = require('path');

const contentJsPath = path.join(__dirname, '../extension-club-fidelidad/content.js');
let content = fs.readFileSync(contentJsPath, 'utf8');

content = content.replace(
    /const lastDate = pet\.lastFoodAlertDate;\s*const cycle = Number\(pet\.foodCycleDays\) \|\| 30;\s*let dateText = "";\s*if \(lastDate\) \{\s*const date = new Date\(lastDate \+ 'T12:00:00'\);\s*date\.setDate\(date\.getDate\(\) \+ cycle\);\s*dateText = ` \(vence \$\{date\.toLocaleDateString\('es-AR', \{ day: '2-digit', month: '2-digit' \}\)\}\)`;\s*\}/g,
    `const rawLastDate = pet.lastPurchaseDate;
                            const cycle = Number(pet.frequencyDays) || 30;
                            let dateText = "";
                            if (rawLastDate) {
                                let parsedDate = null;
                                if (typeof rawLastDate === 'object' && rawLastDate._seconds) {
                                    parsedDate = new Date(rawLastDate._seconds * 1000);
                                } else {
                                    parsedDate = new Date(rawLastDate + 'T12:00:00');
                                }
                                parsedDate.setDate(parsedDate.getDate() + cycle);
                                dateText = \` (vence \${parsedDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })})\`;
                            }`
);

fs.writeFileSync(contentJsPath, content, 'utf8');
console.log('Patched content.js single pet block');
