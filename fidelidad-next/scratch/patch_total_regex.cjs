const fs = require('fs');

const contentFile = 'extension-club-fidelidad/content.js';
let contentJS = fs.readFileSync(contentFile, 'utf8');

const regex = /const total = filteredBirthdays\.length \+ filteredExpirations\.length \+ filteredPetAlerts\.length \+ filteredRedemptions\.length \+ filteredAssignments\.length;/;

const replacement = `
                    const filteredMysteryBoxes = (data.mysteryBoxes || []).filter(mb => getStatus(mb.alertId) === 'pending');
                    const filteredCampaigns = (data.campaigns?.list || []).filter(c => getStatus(c.alertId) === 'pending');
                    const total = filteredBirthdays.length + filteredExpirations.length + filteredPetAlerts.length + filteredRedemptions.length + filteredAssignments.length + filteredMysteryBoxes.length + filteredCampaigns.length;
`;

if (contentJS.match(regex)) {
    contentJS = contentJS.replace(regex, replacement);
    contentJS = contentJS.replace(/V58/g, 'V59');
    fs.writeFileSync(contentFile, contentJS);

    const clientProfileFile = 'src/modules/client/pages/ClientProfilePage.tsx';
    let clientProfileTSX = fs.readFileSync(clientProfileFile, 'utf8');
    clientProfileTSX = clientProfileTSX.replace(/V58/g, 'V59');
    fs.writeFileSync(clientProfileFile, clientProfileTSX);

    console.log("Patched correctly to V59");
} else {
    console.log("Regex did not match!");
}
