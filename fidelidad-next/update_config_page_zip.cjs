const fs = require('fs');
const path = 'src/modules/admin/pages/ConfigPage.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/Integrador_Beneficios_V1\.[0-9]+\.zip/g, 'Integrador_Beneficios_V1.87.zip');
fs.writeFileSync(path, content, 'utf8');
console.log('Zip version updated');
