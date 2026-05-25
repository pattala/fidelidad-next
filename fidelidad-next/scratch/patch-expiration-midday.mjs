import fs from 'fs';
import path from 'path';

const root = 'C:/Users/pablo/.gemini/antigravity/playground/azure-shuttle/fidelidad-next';

let patchCount = 0;
let errorCount = 0;

function patchFile(relativePath, patches) {
    const fullPath = path.join(root, relativePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    const original = content;

    for (const { search, replace, description } of patches) {
        if (content.includes('setHours(12, 0, 0, 0)') && content.includes(search.split('\n')[0])) {
            const idx = content.indexOf(search.split('\n')[0]);
            const snippet = content.substring(idx, idx + replace.length + 10);
            if (snippet.includes('setHours(12')) {
                console.log(`  Already applied: ${description}`);
                continue;
            }
        }
        if (!content.includes(search)) {
            console.error(`  NOT FOUND: ${description}`);
            errorCount++;
            continue;
        }
        content = content.replace(search, replace);
        console.log(`  Patched: ${description}`);
        patchCount++;
    }

    if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`  Saved: ${relativePath}`);
    }
}

console.log('\n--- api/assign-points.js ---');
patchFile('api/assign-points.js', [
    {
        description: 'Normalize client expirationDate to midday',
        search: "        const expirationDate = new Date(recordDate);\n        expirationDate.setDate(expirationDate.getDate() + validityDays);",
        replace: "        const expirationDate = new Date(recordDate);\n        expirationDate.setDate(expirationDate.getDate() + validityDays);\n        expirationDate.setHours(12, 0, 0, 0); // Normalize to midday to prevent timezone drift"
    },
    {
        description: 'Normalize referral rExpirationDate to midday',
        search: "                const rExpirationDate = new Date(now);\n                rExpirationDate.setDate(rExpirationDate.getDate() + rValidityDays);",
        replace: "                const rExpirationDate = new Date(now);\n                rExpirationDate.setDate(rExpirationDate.getDate() + rValidityDays);\n                rExpirationDate.setHours(12, 0, 0, 0); // Normalize to midday to prevent timezone drift"
    }
]);

console.log('\n--- api/users.js ---');
patchFile('api/users.js', [
    {
        description: 'Normalize welcome/address expirationDate to midday',
        search: "            const expirationDate = new Date(now);\n            expirationDate.setDate(expirationDate.getDate() + validityDays);",
        replace: "            const expirationDate = new Date(now);\n            expirationDate.setDate(expirationDate.getDate() + validityDays);\n            expirationDate.setHours(12, 0, 0, 0); // Normalize to midday to prevent timezone drift"
    }
]);

console.log('\n--- api/engine-daily.js ---');
patchFile('api/engine-daily.js', [
    {
        description: 'Normalize birthday expirationDate to midday',
        search: "                        let expirationDate = new Date(referenceDate);\n                        expirationDate.setDate(expirationDate.getDate() + 365);",
        replace: "                        let expirationDate = new Date(referenceDate);\n                        expirationDate.setDate(expirationDate.getDate() + 365);\n                        expirationDate.setHours(12, 0, 0, 0); // Normalize to midday to prevent timezone drift"
    }
]);

console.log('\n--- src/services/birthdayService.ts ---');
patchFile('src/services/birthdayService.ts', [
    {
        description: 'Normalize birthday (manual admin) expirationDate to midday',
        search: "            const expirationDate = new Date(now);\n            expirationDate.setDate(expirationDate.getDate() + validityDays);",
        replace: "            const expirationDate = new Date(now);\n            expirationDate.setDate(expirationDate.getDate() + validityDays);\n            expirationDate.setHours(12, 0, 0, 0); // Normalize to midday to prevent timezone drift"
    }
]);

console.log(`\nPatches applied: ${patchCount}`);
if (errorCount > 0) console.log(`Errors (not found): ${errorCount}`);
else console.log('All patches applied successfully!');
