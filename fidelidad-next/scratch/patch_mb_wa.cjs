const fs = require('fs');
let c = fs.readFileSync('extension-club-fidelidad/content.js', 'utf8');

c = c.replace(/<button class="cf-action-btn cf-action-whatsapp" data-id="\$\{b\.alertId\}" data-type="\$\{b\.type\}" data-phone="\$\{b\.phone\}" data-name="\$\{b\.userName \|\| 'Socio'\}" style="background:#22c55e; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:10px;">\s*WA\s*<\/button>/g, 
`\${b.phone ? \`<button class="cf-action-btn cf-action-whatsapp" data-id="\${b.alertId}" data-type="\${b.type}" data-phone="\${b.phone}" data-name="\${b.userName || 'Socio'}" style="background:#22c55e; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:10px;">
                                WA
                            </button>\` : ''}`);

c = c.replace(/V63/g, 'V64');

fs.writeFileSync('extension-club-fidelidad/content.js', c);

const cp = 'src/modules/client/pages/ClientProfilePage.tsx';
let d = fs.readFileSync(cp, 'utf8');
d = d.replace(/V63/g, 'V64');
fs.writeFileSync(cp, d);
console.log("Patched renderMysteryBoxes WA button");
