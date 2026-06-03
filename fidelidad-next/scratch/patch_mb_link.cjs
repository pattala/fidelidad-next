const fs = require('fs');
let c = fs.readFileSync('extension-club-fidelidad/content.js', 'utf8');

c = c.replace(/} else if \(type === 'mysteryBox'\) {([\s\S]*?)msg = tpl;/, 
`} else if (type === 'mysteryBox') {
            const pwaUrl = cfg?.contact?.pwaUrl || cfg?.apiUrl || 'https://fidelidad-next.vercel.app';
            const chanceUrl = \`\${pwaUrl}/play/\${extra}\`;
            const defaultTpl = \`¡Hola {nombre}! 🎁 ¡Acabas de ganarte un Sorteo Sorpresa! Ingresá a este link para jugar y abrirla: {link}\`;
            const tpl = templates.whatsappMysteryBox || defaultTpl;
            msg = tpl.replace('{link}', chanceUrl);`);

c = c.replace(/data-name="\$\{b\.userName \|\| 'Socio'\}" style="background:#22c55e;/g, 
`data-name="\${b.userName || 'Socio'}" data-extra="\${b.id}" style="background:#22c55e;`);

c = c.replace(/V64/g, 'V65');

fs.writeFileSync('extension-club-fidelidad/content.js', c);

const cp = 'src/modules/client/pages/ClientProfilePage.tsx';
let d = fs.readFileSync(cp, 'utf8');
d = d.replace(/V64/g, 'V65');
fs.writeFileSync(cp, d);
console.log("Patched mystery box WA link");
