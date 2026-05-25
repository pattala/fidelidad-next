const fs = require("fs");
let alerts = fs.readFileSync("src/modules/admin/components/GlobalAlerts.tsx", "utf8");

alerts = alerts.replace(
    /const pendingC = campaignAlerts\.filter\(u => \{[\s\S]*?return true;\s*\}\);/,
    "const pendingC = campaignAlerts.filter(u => !processedAlerts[u.alertId]);"
);

alerts = alerts.replace(
    /const procC = campaignAlerts\.filter\(u => \{[\s\S]*?return true;\s*\}\);/,
    "const procC = campaignAlerts.filter(u => !!processedAlerts[u.alertId]);"
);

fs.writeFileSync("src/modules/admin/components/GlobalAlerts.tsx", alerts);
