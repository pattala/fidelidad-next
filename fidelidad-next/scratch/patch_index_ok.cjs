const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../public/installer/index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Modificamos el HTML para agregar la alerta de "Todo OK"
const htmlTarget = `<div id="firebaseAlert"`;
const htmlInject = `<!-- ALERTA DE FIREBASE OK -->
            <div id="firebaseAlertOk" style="display: none; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <p style="font-weight: 800; font-size: 13px; color: #10b981; margin-bottom: 5px;">✅ Reglas de Firebase al día</p>
                <p style="font-size: 12px; color: var(--text-muted);">
                    No hay cambios pendientes en Reglas o Índices. Con hacer el Merge de código es suficiente.
                </p>
            </div>
            
            <div id="firebaseAlert"`;

if (!htmlContent.includes('id="firebaseAlertOk"')) {
    htmlContent = htmlContent.replace(htmlTarget, htmlInject);
}

// Modificamos la lógica JS
const jsTarget = `                    if (fbData.hasChanges) {
                        alertBox.style.display = 'block';
                    } else {
                        alertBox.style.display = 'none';
                    }`;

const jsInject = `                    const alertBoxOk = document.getElementById('firebaseAlertOk');
                    if (fbData.hasChanges) {
                        alertBox.style.display = 'block';
                        if (alertBoxOk) alertBoxOk.style.display = 'none';
                    } else {
                        alertBox.style.display = 'none';
                        if (alertBoxOk) alertBoxOk.style.display = 'block';
                    }`;

if (!htmlContent.includes('alertBoxOk.style.display')) {
    htmlContent = htmlContent.replace(jsTarget, jsInject);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log("Patched index.html with positive alert");
} else {
    console.log("Already patched");
}
