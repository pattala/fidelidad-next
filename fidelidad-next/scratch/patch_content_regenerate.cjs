const fs = require('fs');
let c = fs.readFileSync('extension-club-fidelidad/content.js', 'utf8');

const targetStr = `        ui.querySelectorAll('.cf-action-whatsapp').forEach(btn => btn.onclick = () => {
            const url = generateWhatsAppToken(btn.dataset.type, btn.dataset.phone, btn.dataset.name, btn.dataset.extra, config, btn.dataset.socio, btn.dataset.date);
            if (url) window.open(url, '_blank');
            updateStorage(btn.dataset.id, 'sent');
        });`;

const replacementStr = `        ui.querySelectorAll('.cf-action-whatsapp').forEach(btn => btn.onclick = async () => {
            const originalText = btn.innerText;
            btn.innerText = '...';
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            
            try {
                let extraId = btn.dataset.extra;
                if (btn.dataset.type === 'mysteryBox') {
                    const res = await apiBridge({
                        url: \`\${config.apiUrl}/api/regenerate-mystery-box\`,
                        method: 'POST',
                        headers: { 'x-api-key': config.apiKey },
                        body: { alertId: btn.dataset.id }
                    });
                    
                    if (res && res.newId) {
                        extraId = res.newId;
                    }
                }
                
                const url = generateWhatsAppToken(btn.dataset.type, btn.dataset.phone, btn.dataset.name, extraId, config, btn.dataset.socio, btn.dataset.date);
                if (url) window.open(url, '_blank');
                updateStorage(btn.dataset.id, 'sent');
            } catch (err) {
                console.error("Error regenerating code:", err);
                alert("Error: " + err.message);
                btn.innerText = originalText;
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });`;

c = c.replace(targetStr, replacementStr);
c = c.replace(/V66/g, 'V67');

fs.writeFileSync('extension-club-fidelidad/content.js', c);

const cp = 'src/modules/client/pages/ClientProfilePage.tsx';
let d = fs.readFileSync(cp, 'utf8');
d = d.replace(/V66/g, 'V67');
fs.writeFileSync(cp, d);
console.log("Patched content.js for mystery box regeneration");
