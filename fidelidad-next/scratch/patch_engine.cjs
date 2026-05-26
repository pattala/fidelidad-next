const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../api/engine-campaigns.js');
let content = fs.readFileSync(filePath, 'utf8');

const oldLogic = `            // 1. ¿Ya se envió hoy?
            if (camp.broadcastSentAt === todayStr && !isManualSim) {
                results.skipped++;
                continue;
            }`;

const newLogic = `            // 1. ¿Ya se envió hoy?
            if (camp.broadcastSentAt === todayStr && !isManualSim) {
                results.skipped++;
                continue;
            }

            // 1.5 ¿Tiene fecha específica de envío programada?
            if (!camp.isFlash && camp.nextBroadcastDate) {
                if (camp.nextBroadcastDate !== todayStr && !isManualSim) {
                    results.skipped++;
                    continue;
                }
            }`;

let normalizedContent = content.replace(/\r\n/g, '\n');
normalizedContent = normalizedContent.replace(oldLogic.replace(/\r\n/g, '\n'), newLogic.replace(/\r\n/g, '\n'));

fs.writeFileSync(filePath, normalizedContent, 'utf8');
console.log("Patched engine-campaigns.js successfully.");
