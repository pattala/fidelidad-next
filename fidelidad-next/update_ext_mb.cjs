const fs = require('fs');
const path = 'extension-club-fidelidad/content.js';
let content = fs.readFileSync(path, 'utf8');

// Replace the container and checkbox generation logic
const searchHtml = `<div id="cf-mystery-box-container" style="display:none; margin-top: 15px; margin-bottom: 15px; padding: 10px; background: #fff7ed; border: 1px dashed #fb923c; border-radius: 12px;">
                        <label style="display:flex; align-items:center; cursor:pointer; gap:8px;">
                            <input type="checkbox" id="cf-generate-mystery-box" checked style="width:16px; height:16px; accent-color:#ea580c;" />`;

const replaceHtml = `<div id="cf-mystery-box-container" style="display:none; margin-top: 15px; margin-bottom: 15px; padding: 10px; background: #fff7ed; border: 1px dashed #fb923c; border-radius: 12px;">
                        <label style="display:flex; align-items:center; cursor:pointer; gap:8px;">
                            <input type="checkbox" id="cf-generate-mystery-box" checked style="width:16px; height:16px; accent-color:#ea580c;" />`;

content = content.replace(searchHtml, replaceHtml); // I will inject the disabled logic dynamically.

// Wait, the dynamic rendering is better done when we show the panel.
// Around line 840 where we do: `mbxContainer.style.display = 'block';`

const searchLogic = `// Auto-show mystery box si esta encendido y val >= minAmount
        const mbxContainer = document.getElementById('cf-mystery-box-container');
        if (mbxContainer && window._cfFullData && window._cfFullData.mysteryBoxConfig && window._cfFullData.mysteryBoxConfig.enabled) {
            if (val >= (window._cfFullData.mysteryBoxConfig.minAmount || 0)) {
                mbxContainer.style.display = 'block';
            } else {
                mbxContainer.style.display = 'none';
            }
        }`;

const replaceLogic = `// Auto-show mystery box si esta encendido y val >= minAmount
        const mbxContainer = document.getElementById('cf-mystery-box-container');
        const mbCheckbox = document.getElementById('cf-generate-mystery-box');
        if (mbxContainer && window._cfFullData && window._cfFullData.mysteryBoxConfig && window._cfFullData.mysteryBoxConfig.enabled) {
            if (val >= (window._cfFullData.mysteryBoxConfig.minAmount || 0)) {
                mbxContainer.style.display = 'block';
                if (mbCheckbox) {
                    if (window._cfFullData.mysteryBoxConfig.cashierDecision === false) {
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
        } else {
            if (mbxContainer) mbxContainer.style.display = 'none';
        }`;

content = content.replace(searchLogic, replaceLogic);

fs.writeFileSync(path, content, 'utf8');
console.log('content.js replaced');
