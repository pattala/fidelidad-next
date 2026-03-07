const fs = require('fs');
const path = 'c:/Users/pablo/.gemini/antigravity/playground/azure-shuttle/fidelidad-next/src/modules/admin/pages/ConfigPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix Rules to Legales transition
content = content.replace(/}\s*\{\s*activeTab === 'legales' && \(/g, "}\n                                    {activeTab === 'legales' && (");

// Fix Legales to Branding transition
content = content.replace(/\)\s*}\s*{\s*activeTab === 'branding' && \(/g, ")}\n                                            {activeTab === 'branding' && (");

// Fix Branding to Messaging transition
content = content.replace(/\)\s*}\s*{activeTab === 'messaging' && \(/g, ")}\n                                            {activeTab === 'messaging' && (");

fs.writeFileSync(path, content);
console.log('Tabs normalized');
