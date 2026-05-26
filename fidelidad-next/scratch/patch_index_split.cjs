const fs = require('fs');
const path = require('path');

// 1. Modificar installer-server.js
const serverPath = path.join(__dirname, '../installer-server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

serverContent = serverContent.replace(
    /const fbFiles = files\.filter[\s\S]*?res\.json\(\{ hasChanges: fbFiles\.length > 0, files: fbFiles \}\);/m,
    `const rulesChanged = files.some(f => f.includes('firestore.rules'));
            const indexesChanged = files.some(f => f.includes('firestore.indexes.json'));
            res.json({ rulesChanged, indexesChanged });`
);
fs.writeFileSync(serverPath, serverContent, 'utf8');


// 2. Modificar index.html
const htmlPath = path.join(__dirname, '../public/installer/index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Remover HTML viejo
const oldHtmlStart = `<!-- ALERTA DE FIREBASE OK -->`;
const oldHtmlEnd = `</p>\n            </div>\n\n            <button id="btnGitSync"`;
const startIndex = htmlContent.indexOf(oldHtmlStart);
const endIndex = htmlContent.indexOf(oldHtmlEnd) + oldHtmlEnd.length - `<button id="btnGitSync"`.length;

if (startIndex !== -1 && endIndex !== -1) {
    const newHtml = `<!-- ALERTAS DE FIREBASE -->
            <div id="firebaseAlertsContainer" style="display: none; border-radius: 12px; padding: 15px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
                <p style="font-size: 13px; font-weight: 800; margin-bottom: 10px; color: var(--text-main);">Estado de Firebase (Motor B)</p>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <div id="fbRulesAlert" style="display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 8px; border-radius: 8px;"></div>
                    <div id="fbIndexesAlert" style="display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 8px; border-radius: 8px;"></div>
                </div>
            </div>

            `;
    
    htmlContent = htmlContent.substring(0, startIndex) + newHtml + htmlContent.substring(endIndex);
}

// Remover JS viejo y reemplazar con nuevo
const jsRegex = /\/\/ Verificar cambios en Firebase[\s\S]*?\} catch\(err\) \{\s*console\.error\("Error consultando firebase diff:", err\);\s*\}/m;
const newJs = `// Verificar cambios en Firebase
            try {
                const fbResponse = await fetch('/api/firebase-diff');
                const fbData = await fbResponse.json();
                
                const container = document.getElementById('firebaseAlertsContainer');
                const rulesAlert = document.getElementById('fbRulesAlert');
                const indexesAlert = document.getElementById('fbIndexesAlert');
                
                if (container && rulesAlert && indexesAlert) {
                    container.style.display = 'block';
                    
                    if (fbData.rulesChanged) {
                        rulesAlert.style.background = 'rgba(239, 68, 68, 0.1)';
                        rulesAlert.style.color = '#ef4444';
                        rulesAlert.innerHTML = '⚠️ <strong>Reglas de Seguridad:</strong> Cambios detectados. Requiere despliegue.';
                    } else {
                        rulesAlert.style.background = 'rgba(16, 185, 129, 0.1)';
                        rulesAlert.style.color = '#10b981';
                        rulesAlert.innerHTML = '✅ <strong>Reglas de Seguridad:</strong> Sin cambios pendientes.';
                    }
                    
                    if (fbData.indexesChanged) {
                        indexesAlert.style.background = 'rgba(239, 68, 68, 0.1)';
                        indexesAlert.style.color = '#ef4444';
                        indexesAlert.innerHTML = '⚠️ <strong>Índices de Búsqueda:</strong> Cambios detectados. Requiere despliegue.';
                    } else {
                        indexesAlert.style.background = 'rgba(16, 185, 129, 0.1)';
                        indexesAlert.style.color = '#10b981';
                        indexesAlert.innerHTML = '✅ <strong>Índices de Búsqueda:</strong> Sin cambios pendientes.';
                    }
                }
            } catch(err) {
                console.error("Error consultando firebase diff:", err);
            }`;

htmlContent = htmlContent.replace(jsRegex, newJs);

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log("Patched index.html with split alerts");
