const fs = require('fs');
let c = fs.readFileSync('extension-club-fidelidad/content.js', 'utf8');

const target = `            const tpl = templates.whatsappMysteryBox || defaultTpl;
            msg = tpl.replace('{link}', chanceUrl);`;

const replacement = `            const tpl = templates.whatsappMysteryBox || defaultTpl;
            msg = tpl.includes('{link}') ? tpl.replace('{link}', chanceUrl) : tpl + '\\n\\nLink para jugar: ' + chanceUrl;`;

c = c.replace(target, replacement);
c = c.replace(/V65/g, 'V66');

fs.writeFileSync('extension-club-fidelidad/content.js', c);

const cp = 'src/modules/client/pages/ClientProfilePage.tsx';
let d = fs.readFileSync(cp, 'utf8');
d = d.replace(/V65/g, 'V66');
fs.writeFileSync(cp, d);
console.log("Patched mystery box WA link safe append");
