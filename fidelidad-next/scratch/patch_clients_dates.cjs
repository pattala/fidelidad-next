const fs = require('fs');
const file = 'src/modules/admin/pages/ClientsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /let parsedDate = raw\._seconds \? new Date\(raw\._seconds \* 1000\) : new Date\(raw \+ 'T12:00:00'\);/g;
const replacement = `let parsedDate = raw instanceof Date ? new Date(raw) : (raw._seconds ? new Date(raw._seconds * 1000) : new Date(raw + 'T12:00:00'));
                                                    if (isNaN(parsedDate.getTime())) parsedDate = new Date();`;

content = content.replace(regex, replacement);

// Additionally, we need to fix lines 1799-1804 if they miss a safety check for lastLitterPurchaseDate empty!
const regex2 = /\{pet\.type === 'gato' && \(\s*<div className="flex flex-col gap-1\.5">[\s\S]*?\{pet\.lastLitterPurchaseDate && \(/;
// Wait, actually let's just make sure we do the `if (!pet.lastLitterPurchaseDate) return '-';` check
const regex3 = /const last = pet\.lastLitterPurchaseDate instanceof Date \? pet\.lastLitterPurchaseDate : \(pet\.lastLitterPurchaseDate\.toDate \? pet\.lastLitterPurchaseDate\.toDate\(\) : new Date\(pet\.lastLitterPurchaseDate\)\);/;
const replacement3 = `if (!pet.lastLitterPurchaseDate) return '-';
                                                                                              const last = pet.lastLitterPurchaseDate instanceof Date ? pet.lastLitterPurchaseDate : (pet.lastLitterPurchaseDate.toDate ? pet.lastLitterPurchaseDate.toDate() : new Date(pet.lastLitterPurchaseDate));`;

if (content.includes('const last = pet.lastLitterPurchaseDate instanceof Date') && !content.includes('if (!pet.lastLitterPurchaseDate) return \'- \';')) {
    content = content.replace(regex3, replacement3);
}

// And also line 1759 for lastPurchaseDate
const regex4 = /const last = pet\.lastPurchaseDate instanceof Date \? pet\.lastPurchaseDate : \(pet\.lastPurchaseDate\.toDate \? pet\.lastPurchaseDate\.toDate\(\) : new Date\(pet\.lastPurchaseDate\)\);/;
const replacement4 = `if (!pet.lastPurchaseDate) return '-';
                                                                        const last = pet.lastPurchaseDate instanceof Date ? pet.lastPurchaseDate : (pet.lastPurchaseDate.toDate ? pet.lastPurchaseDate.toDate() : new Date(pet.lastPurchaseDate));`;

content = content.replace(regex4, replacement4);

fs.writeFileSync(file, content);
console.log('ClientsPage patched for dates');
