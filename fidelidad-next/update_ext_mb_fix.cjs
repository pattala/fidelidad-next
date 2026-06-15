const fs = require('fs');
const path = 'extension-club-fidelidad/content.js';
let content = fs.readFileSync(path, 'utf8');

const searchLogic = `// Auto-show mystery box si esta encendido y val >= minAmount
        const mbxContainer = document.getElementById('cf-mystery-box-container');
        if (mbxContainer && window._cfFullData && window._cfFullData.config?.mysteryBox && window._cfFullData.config.mysteryBox.enabled) {
            if (val >= (window._cfFullData.config.mysteryBox.minAmount || 0)) {
                mbxContainer.style.display = 'block';
            } else {
                mbxContainer.style.display = 'none';
            }
        }`;

const replaceLogic = `// Auto-show mystery box si esta encendido y val >= minAmount
        const mbxContainer = document.getElementById('cf-mystery-box-container');
        const mbCheckbox = document.getElementById('cf-generate-mystery-box');
        if (mbxContainer && window._cfFullData && window._cfFullData.config?.mysteryBox && window._cfFullData.config.mysteryBox.enabled) {
            if (val >= (window._cfFullData.config.mysteryBox.minAmount || 0)) {
                mbxContainer.style.display = 'block';
                if (mbCheckbox) {
                    if (window._cfFullData.config.mysteryBox.cashierDecision === false) {
                        mbCheckbox.checked = true;
                        mbCheckbox.disabled = true;
                        mbCheckbox.style.opacity = '0.5';
                    } else {
                        mbCheckbox.disabled = false;
                        mbCheckbox.style.opacity = '1';
                    }
                }
            } else {
                mbxContainer.style.display = 'none';
            }
        } else if (mbxContainer) {
            mbxContainer.style.display = 'none';
        }`;

content = content.replace(searchLogic, replaceLogic);

// Version bump
content = content.replace(/VERSIÓN EMPLEADO V48/g, 'VERSIÓN EMPLEADO V49');
content = content.replace(/V48: Iniciando extensión/g, 'V49: Iniciando extensión');

fs.writeFileSync(path, content, 'utf8');
console.log('content.js replaced properly');
