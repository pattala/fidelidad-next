const fs = require('fs');

let c = fs.readFileSync('extension-club-fidelidad/content.js', 'utf8');

const regex = /if \(total > 0 \|\| localList\.length > 0\) \{\s*showGlobalAlert\(processedData, config\);\s*\} else \{\s*const w = document\.getElementById\('cf-v35-bubble'\);\s*if \(w\) w\.remove\(\);\s*\}/;

c = c.replace(regex, "showGlobalAlert(processedData, config); // ALWAYS SHOW");
c = c.replace(/V60/g, 'V61');

fs.writeFileSync('extension-club-fidelidad/content.js', c);

const cp = 'src/modules/client/pages/ClientProfilePage.tsx';
let d = fs.readFileSync(cp, 'utf8');
d = d.replace(/V60/g, 'V61');
fs.writeFileSync(cp, d);
console.log("Forced bubble to always show");
