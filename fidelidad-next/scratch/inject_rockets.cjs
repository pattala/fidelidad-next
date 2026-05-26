const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace using Regex to match the Eye button and append the Rocket button right after it.
// We avoid double-injecting by checking if Rocket is already there (which shouldn't be for most).
content = content.replace(/(<button type="button" onClick={\(\) => openPreview\('([^']+)'(?:, '[^']+')?\)}[^>]*><Eye size=\{16\} \/><\/button>)(?!\s*<button[^>]*><Rocket)/g, `$1\n                                                            <button type="button" onClick={() => openTestModal('$2')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed missing rocket buttons.');
