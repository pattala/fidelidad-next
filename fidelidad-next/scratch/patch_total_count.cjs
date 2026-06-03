const fs = require('fs');

const contentFile = 'extension-club-fidelidad/content.js';
let contentJS = fs.readFileSync(contentFile, 'utf8');

const targetStr = `const filteredRedemptions = rList.filter(r => getStatus(r.alertId) === 'pending');
                    const filteredAssignments = aList.filter(a => getStatus(a.alertId) === 'pending');

                    const total = filteredBirthdays.length + filteredExpirations.length + filteredPetAlerts.length + filteredRedemptions.length + filteredAssignments.length;`;

const replaceStr = `const filteredRedemptions = rList.filter(r => getStatus(r.alertId) === 'pending');
                    const filteredAssignments = aList.filter(a => getStatus(a.alertId) === 'pending');
                    const filteredMysteryBoxes = (data.mysteryBoxes || []).filter(mb => getStatus(mb.alertId) === 'pending');
                    const filteredCampaigns = (data.campaigns?.list || []).filter(c => getStatus(c.alertId) === 'pending');

                    const total = filteredBirthdays.length + filteredExpirations.length + filteredPetAlerts.length + filteredRedemptions.length + filteredAssignments.length + filteredMysteryBoxes.length + filteredCampaigns.length;`;

contentJS = contentJS.replace(targetStr, replaceStr);

contentJS = contentJS.replace(/V57/g, 'V58');

fs.writeFileSync(contentFile, contentJS);

const clientProfileFile = 'src/modules/client/pages/ClientProfilePage.tsx';
let clientProfileTSX = fs.readFileSync(clientProfileFile, 'utf8');
clientProfileTSX = clientProfileTSX.replace(/V57/g, 'V58');
fs.writeFileSync(clientProfileFile, clientProfileTSX);

console.log('Fixed visibility logic for mystery boxes and campaigns in extension, bumped to V58');
