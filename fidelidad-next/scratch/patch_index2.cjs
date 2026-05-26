const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../public/installer/index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// HTML Injection
const htmlTarget = `<button id="btnGitSync"`;
const htmlInject = `<!-- ALERTA DE FIREBASE -->
            <div id="firebaseAlert" style="display: none; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <p style="font-weight: 800; font-size: 13px; color: #ef4444; margin-bottom: 5px;">⚠️ ATENCIÓN: Se detectaron cambios en Firebase</p>
                <p style="font-size: 12px; color: var(--text-muted);">
                    Se encontraron modificaciones pendientes en Reglas o Índices. 
                    Después de sincronizar el código, recuerda ir a la sección "Motor B" para desplegar las reglas a tus clientes.
                </p>
            </div>

            <button id="btnGitSync"`;

if (!htmlContent.includes('id="firebaseAlert"')) {
    htmlContent = htmlContent.replace(htmlTarget, htmlInject);
}

// JS Injection
// We want to insert logic after setting data.main inside refreshVersions()
const jsTarget = `            document.getElementById('v-main').textContent = data.main;`;
const jsInject = `            document.getElementById('v-main').textContent = data.main;

            // Verificar cambios en Firebase
            try {
                const fbResponse = await fetch('/api/firebase-diff');
                const fbData = await fbResponse.json();
                
                const alertBox = document.getElementById('firebaseAlert');
                if (alertBox) {
                    if (fbData.hasChanges) {
                        alertBox.style.display = 'block';
                    } else {
                        alertBox.style.display = 'none';
                    }
                }
            } catch(err) {
                console.error("Error consultando firebase diff:", err);
            }`;

if (!htmlContent.includes('/api/firebase-diff')) {
    htmlContent = htmlContent.replace(jsTarget, jsInject);
}

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log("Patched index.html safely");
