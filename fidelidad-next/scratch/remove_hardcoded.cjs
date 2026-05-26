const fs = require('fs');
const path = require('path');

const campPath = path.join(__dirname, '../src/modules/admin/pages/CampaignsPage.tsx');
let campContent = fs.readFileSync(campPath, 'utf8');

campContent = campContent.replace(/\(bonus\.rewardText \? \`¡\$\{bonus\.rewardText\}!\` \: 'Consultanos\.'\)/g, "(bonus.rewardText ? `¡${bonus.rewardText}!` : '')");
campContent = campContent.replace(/bonus\.description \|\| '¡Sumá más puntos!'/g, "bonus.description || ''");
fs.writeFileSync(campPath, campContent, 'utf8');

const configPath = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace test placeholders with empty or obvious test indicators, but user requested NO hardcoded text
configContent = configContent.replace(/\.replace\(\{detalle\}\/g, 'Detalle de oferta'\)/g, ".replace(/{detalle}/g, '')");
// Any other placeholders in processText in ConfigPage.tsx?
// .replace(/{horario}/g, '20:00')
// .replace(/{hora_inicio}/g, '18:00')
// I'll leave the times as they make sense for testing format, but the text fallbacks are what the user dislikes.
fs.writeFileSync(configPath, configContent, 'utf8');

console.log('Removed hardcoded texts');
