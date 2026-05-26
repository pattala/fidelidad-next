const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /const defaultTemplates: Record<string, string> = {[\s\S]*?};\n/;

const correctTemplates = `const defaultTemplates: Record<string, string> = {
            welcome: \`¡Bienvenido a \${config.siteName}! 🎉\`,
            purchase: \`¡Suma de Puntos! 🌟\`,
            reward: \`¡Premio Canjeado! 🏆\`,
            campaign: \`Novedades en \${config.siteName}\`,
            offer: \`Oferta Especial - \${config.siteName}\`,
            flashOffer: \`¡OFERTA FLASH! ⚡\`,
            birthday: \`¡Feliz Cumpleaños! 🎂\`,
            birthdaySimple: \`¡Muy Feliz Cumpleaños! 🎂\`,
            referralReward: \`Premio por Invitación 🎁\`,
            referralPoints: \`Puntos por Referido 🎁\`,
            expirationWarning: \`Aviso de Vencimiento de Puntos ⏰\`,
            referralChallenge: \`¡NUEVO DESAFÍO ACTIVO! 🎯\`
        };\n`;

if (content.match(regex)) {
    content = content.replace(regex, correctTemplates);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully replaced defaultTemplates");
} else {
    console.log("Could not find defaultTemplates using regex!");
}
