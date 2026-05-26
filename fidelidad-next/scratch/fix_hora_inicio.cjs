const fs = require('fs');
const path = require('path');

// Fix CampaignsPage.tsx
const campPath = path.join(__dirname, '../src/modules/admin/pages/CampaignsPage.tsx');
let campContent = fs.readFileSync(campPath, 'utf8');

const target1 = `                if (bonus.isFlash) {
                    const horario = bonus.endTime || '23:59';
                    msg = msg.replace(/{titulo}/g, bonus.flashTitle || bonus.title || bonus.name)
                             .replace(/{detalle}/g, bonus.flashDescription || bonus.description || (bonus.rewardText ? \`¡\${bonus.rewardText}!\` : 'Consultanos.'))
                             .replace(/{horario}/g, horario);
                }`;

const replace1 = `                if (bonus.isFlash) {
                    const horario = bonus.endTime || '23:59';
                    const hora_inicio = bonus.startTime || '00:00';
                    msg = msg.replace(/{titulo}/g, bonus.flashTitle || bonus.title || bonus.name)
                             .replace(/{detalle}/g, bonus.flashDescription || bonus.description || (bonus.rewardText ? \`¡\${bonus.rewardText}!\` : 'Consultanos.'))
                             .replace(/{horario}/g, horario)
                             .replace(/{hora_inicio}/g, hora_inicio);
                }`;

const target2 = `            if (bonus.isFlash) {
                template = config?.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer;
                const horario = bonus.endTime || '23:59';
                msg = template
                    .replace(/{titulo}/g, bonus.flashTitle || bonus.title || bonus.name)
                    .replace(/{detalle}/g, bonus.flashDescription || bonus.description || (bonus.rewardText ? \`¡\${bonus.rewardText}!\` : 'Consultanos.'))
                    .replace(/{horario}/g, horario);`;

const replace2 = `            if (bonus.isFlash) {
                template = config?.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer;
                const horario = bonus.endTime || '23:59';
                const hora_inicio = bonus.startTime || '00:00';
                msg = template
                    .replace(/{titulo}/g, bonus.flashTitle || bonus.title || bonus.name)
                    .replace(/{detalle}/g, bonus.flashDescription || bonus.description || (bonus.rewardText ? \`¡\${bonus.rewardText}!\` : 'Consultanos.'))
                    .replace(/{horario}/g, horario)
                    .replace(/{hora_inicio}/g, hora_inicio);`;

campContent = campContent.replace(target1, replace1).replace(target2, replace2);
fs.writeFileSync(campPath, campContent, 'utf8');

// Fix ConfigPage.tsx
const configPath = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
let configContent = fs.readFileSync(configPath, 'utf8');

const t1 = `<VariableChips vars={['siteName', 'titulo', 'detalle', 'horario']} onSelect={v => insertVar('flashOffer', v)} />`;
const r1 = `<VariableChips vars={['siteName', 'titulo', 'detalle', 'hora_inicio', 'horario']} onSelect={v => insertVar('flashOffer', v)} />`;

const t2 = `.replace(/{detalle}/g, 'Detalle de oferta')
                                        .replace(/{horario}/g, '20:00');`;
const r2 = `.replace(/{detalle}/g, 'Detalle de oferta')
                                        .replace(/{horario}/g, '20:00')
                                        .replace(/{hora_inicio}/g, '18:00');`;

configContent = configContent.replace(t1, r1).replace(t2, r2);
fs.writeFileSync(configPath, configContent, 'utf8');

console.log("Done");
