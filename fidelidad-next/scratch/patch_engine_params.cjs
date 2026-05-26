const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../api/engine-campaigns.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetRegex = /\/\/\s*V\.1\.6\.4:\s*Construir los mensajes[\s\S]*?const PWA_URL = process\.env\.PWA_URL/g;

const match = content.match(targetRegex);
if (!match) {
    console.error("Could not find the target block using regex!");
} else {
    const newLogic = `// V.1.6.4: Construir los mensajes utilizando el formato estético premium de plantillas
            let template = "";
            let msg = "";
            
            // Valores dinámicos por defecto
            const tituloCamp = camp.isFlash ? (camp.flashTitle || camp.title || camp.name) : (camp.title || camp.name);
            const descCamp = camp.isFlash ? (camp.flashDescription || camp.description || '') : (camp.description || '');
            const premio = camp.rewardText || (camp.rewardValue ? camp.rewardValue.toString() : '');
            const puntos = camp.rewardValue ? camp.rewardValue.toString() : '';
            const horario = camp.endTime || '23:59';
            const hora_inicio = camp.startTime || '';
            const vencimiento = camp.endDate ? new Date(camp.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'agotar stock';

            if (camp.isFlash) {
                template = config.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer;
                msg = template
                    .replace(/{titulo}/g, tituloCamp)
                    .replace(/{detalle}/g, descCamp || (premio ? \`¡\${premio}!\` : 'Consultanos.'))
                    .replace(/{descripcion}/g, descCamp)
                    .replace(/{horario}/g, horario)
                    .replace(/{hora_inicio}/g, hora_inicio)
                    .replace(/{premio}/g, premio)
                    .replace(/{puntos}/g, puntos);
            } else if (camp.rewardType === 'INFO' || camp.rewardType === 'TEXT') {
                template = config.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer;
                msg = template
                    .replace(/{titulo}/g, tituloCamp)
                    .replace(/{detalle}/g, descCamp || (premio ? \`¡\${premio}!\` : 'Consultanos.'))
                    .replace(/{descripcion}/g, descCamp)
                    .replace(/{vencimiento}/g, vencimiento)
                    .replace(/{premio}/g, premio)
                    .replace(/{puntos}/g, puntos);
            } else {
                template = config.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign;
                msg = template
                    .replace(/{titulo}/g, tituloCamp)
                    .replace(/{descripcion}/g, descCamp || '¡Sumá más puntos!')
                    .replace(/{detalle}/g, descCamp || '¡Sumá más puntos!')
                    .replace(/{premio}/g, premio)
                    .replace(/{puntos}/g, puntos)
                    .replace(/{vencimiento}/g, vencimiento);
            }

            // Fallback general por si quedó alguna etiqueta
            msg = msg.replace(/{hora_inicio}/g, hora_inicio).replace(/{horario}/g, horario).replace(/{descripcion}/g, descCamp).replace(/{titulo}/g, tituloCamp);

            // El título nativo de la push notification (en negrita arriba de todo)
            const title = camp.isFlash ? "⚡ ¡OFERTA FLASH!" : (camp.rewardType === 'INFO' || camp.rewardType === 'TEXT' ? "🎁 ¡Oferta Especial!" : "🚀 ¡Nueva Campaña!");
            // Se puede sobrescribir si en la config admin pusieron algo. Pero lo dejamos así por impacto visual, y usamos el título real en el cuerpo.
            
            const body = msg;
            const url = camp.link || "/";

            const PWA_URL = process.env.PWA_URL`;

    content = content.replace(targetRegex, newLogic);
    
    // Also we need to replace {nombre_completo}
    // Personalized Push
    content = content.replace(
        /const personalizedBody = body\.replace\(\/\{nombre\}\/g, u\.data\.name \|\| u\.data\.nombre \|\| 'Socio'\);/g,
        `const userName = u.data.name || u.data.nombre || 'Socio';
                            const personalizedBody = body.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName);`
    );
    
    // Personalized Email
    content = content.replace(
        /const personalizedBody = body\.replace\(\/\{nombre\}\/g, name \|\| 'Socio'\);/g,
        `const userName = name || 'Socio';
                            const personalizedBody = body.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName);`
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Patched engine parameters successfully.");
}
