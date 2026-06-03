const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/types.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'petFoodAlert?: { channels: MessagingChannel[] };',
    'petFoodAlert?: { channels: MessagingChannel[] };\n            petLitterAlert?: { channels: MessagingChannel[] };'
);

content = content.replace(
    'petFoodAlert?: string;',
    'petFoodAlert?: string;\n            petLitterAlert?: string;'
);

content = content.replace(
    'petFoodAlert_title?: string;',
    'petFoodAlert_title?: string;\n            petLitterAlert_title?: string;'
);

content = content.replace(
    'petFoodAlert_whatsapp?: string;',
    'petFoodAlert_whatsapp?: string;\n            petLitterAlert_whatsapp?: string;'
);

fs.writeFileSync(file, content, 'utf8');
console.log('types.ts patched');
