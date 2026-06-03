const fs = require('fs');

let c = fs.readFileSync('extension-club-fidelidad/content.js', 'utf8');

const regex = /document\.body\.appendChild\(container\);/;
c = c.replace(regex, "document.body.appendChild(container); console.log('✅ BUBBLE APPENDED TO BODY! totalPending = ' + totalPending);");

c = c.replace(/V61/g, 'V62');

fs.writeFileSync('extension-club-fidelidad/content.js', c);

const cp = 'src/modules/client/pages/ClientProfilePage.tsx';
let d = fs.readFileSync(cp, 'utf8');
d = d.replace(/V61/g, 'V62');
fs.writeFileSync(cp, d);
console.log("Added console log to showGlobalAlert");
