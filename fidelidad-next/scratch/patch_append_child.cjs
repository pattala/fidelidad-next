const fs = require('fs');
let c = fs.readFileSync('extension-club-fidelidad/content.js', 'utf8');

const targetStr = `        container.innerHTML = '';
        const ui = document.createElement('div');
        ui.style.pointerEvents = 'auto';`;

const replacementStr = `        let ui = container.querySelector('div.cf-v35-glass') || container.querySelector('div.cf-v35-bubble');
        if (!ui) {
            ui = document.createElement('div');
            container.innerHTML = '';
            container.appendChild(ui);
        }
        ui.style.pointerEvents = 'auto';`;

c = c.replace(targetStr, replacementStr);
c = c.replace(/V61/g, 'V62');
c = c.replace(/showGlobalAlert\(processedData, config\); \/\/ ALWAYS SHOW/, "if (total > 0 || localList.length > 0) {\n                        showGlobalAlert(processedData, config);\n                    } else {\n                        const w = document.getElementById('cf-v35-bubble');\n                        if (w) w.remove();\n                    }");

fs.writeFileSync('extension-club-fidelidad/content.js', c);

const cp = 'src/modules/client/pages/ClientProfilePage.tsx';
let d = fs.readFileSync(cp, 'utf8');
d = d.replace(/V61/g, 'V62');
fs.writeFileSync(cp, d);
console.log("Fixed missing appendChild and reverted ALWAYS SHOW");
