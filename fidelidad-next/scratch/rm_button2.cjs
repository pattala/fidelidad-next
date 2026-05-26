const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove handleTestEmail function
content = content.replace(/const handleTestEmail = async \(\) => {[\s\S]*?};\n\n/g, '');

// Remove Email Preview Button block
content = content.replace(/\s*{\/\* Email Preview Button \*\/\}\s*\{config\.messaging\?\.emailEnabled && \(\s*<div className="flex justify-end pt-2">\s*<button type="button" onClick=\{handleTestEmail\}([\s\S]*?)<\/button>\s*<\/div>\s*\)\}/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Removed legacy button successfully.');
