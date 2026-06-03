const fs = require('fs');
let c = fs.readFileSync('extension-club-fidelidad/content.js', 'utf8');

c = c.replace(/container\.innerHTML = '';\s*const ui = document\.createElement\('div'\);\s*ui\.style\.pointerEvents = 'auto';/, `let ui = container.querySelector('div.cf-v35-glass') || container.querySelector('div.cf-v35-bubble');
        if (!ui) {
            ui = document.createElement('div');
            container.innerHTML = '';
            container.appendChild(ui);
        }
        ui.style.pointerEvents = 'auto';`);

c = c.replace(/V62/g, 'V63');

fs.writeFileSync('extension-club-fidelidad/content.js', c);

const cp = 'src/modules/client/pages/ClientProfilePage.tsx';
let d = fs.readFileSync(cp, 'utf8');
d = d.replace(/V62/g, 'V63');
fs.writeFileSync(cp, d);
console.log("Properly patched appendChild with Regex");
