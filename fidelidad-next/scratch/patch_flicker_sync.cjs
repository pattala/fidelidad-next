const fs = require('fs');

// Patch api/sync-alerts.js
const syncFile = 'api/sync-alerts.js';
let syncContent = fs.readFileSync(syncFile, 'utf8');

const oldSync = `transaction.set(docRef, { 
                actions, 
                lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
                type: 'daily_alerts_sync'
            }, { merge: true });`;

const newSync = `transaction.set(docRef, { 
                actions, 
                lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
                type: 'daily_alerts_sync'
            }, { merge: true });

            if (alertId && alertId.startsWith('mb_')) {
                const mbId = alertId.substring(3);
                const mbRef = db.collection('mystery_box_chances').doc(mbId);
                transaction.set(mbRef, { status: 'resolved' }, { merge: true });
            }`;

if (!syncContent.includes('mbRef')) {
    syncContent = syncContent.replace(oldSync, newSync);
    fs.writeFileSync(syncFile, syncContent);
}

// Patch content.js to fix flickering
const contentFile = 'extension-club-fidelidad/content.js';
let contentJS = fs.readFileSync(contentFile, 'utf8');

const renderRegex = /const render = \(\) => \{\s*container\.innerHTML = '';\s*const ui = document\.createElement\('div'\);\s*ui\.style\.pointerEvents = 'auto';/m;

const newRender = `const render = () => {
        let ui = container.querySelector('div');
        if (!ui) {
            ui = document.createElement('div');
            ui.style.pointerEvents = 'auto';
            container.innerHTML = '';
            container.appendChild(ui);
        }`;

contentJS = contentJS.replace(renderRegex, newRender);

// Wait, if I do that, the old code had `container.appendChild(ui);` at the end of `render()`.
// Let's remove the `container.appendChild(ui);` at the end of `render()` so it doesn't append twice.
contentJS = contentJS.replace(/container\.appendChild\(ui\);\s*\};\s*const renderList =/m, "};\n\n    const renderList =");

// Bump version to V57
contentJS = contentJS.replace(/V56/g, 'V57');
fs.writeFileSync(contentFile, contentJS);

const clientProfileFile = 'src/modules/client/pages/ClientProfilePage.tsx';
let clientProfileTSX = fs.readFileSync(clientProfileFile, 'utf8');
clientProfileTSX = clientProfileTSX.replace(/V56/g, 'V57');
fs.writeFileSync(clientProfileFile, clientProfileTSX);

console.log('Patched sync-alerts.js and content.js (no flicker), bumped to V57');
