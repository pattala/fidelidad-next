const fs = require('fs');
const path = 'api/assign-points.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /if\s*\(\s*req\.body\.generateMysteryBox\s*&&\s*config\.mysteryBox\?\.enabled\s*\)\s*\{/,
    `const isMysteryBoxEligible = Number(req.body.amount || 0) >= (config.mysteryBox?.minAmount || 0);
            const forcedByAdmin = config.mysteryBox?.cashierDecision === false;
            const shouldGenerateMB = forcedByAdmin ? true : req.body.generateMysteryBox;
            if (shouldGenerateMB && config.mysteryBox?.enabled && isMysteryBoxEligible) {`
);

fs.writeFileSync(path, content, 'utf8');
console.log('assign-points replaced');
