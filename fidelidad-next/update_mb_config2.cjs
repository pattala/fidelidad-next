const fs = require('fs');
const path = 'src/modules/admin/components/MysteryBoxConfig.tsx';
let content = fs.readFileSync(path, 'utf8');

const regexToRemoveAviso = /<div className="flex items-center justify-between">[\s\S]*?<h3 className="text-sm font-bold text-gray-700">Aviso de Refuerzo para el Cajero<\/h3>[\s\S]*?<\/div>[\s\S]*?<\/label>[\s\S]*?<\/div>[\s\S]*?(<div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">)/;

content = content.replace(regexToRemoveAviso, '$1');

const regexToRemoveMessage = /\{mb\.enableCashierAlert && \([\s\S]*?Mensaje del Aviso[\s\S]*?<\/div>\s*\)\}/;
content = content.replace(regexToRemoveMessage, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
