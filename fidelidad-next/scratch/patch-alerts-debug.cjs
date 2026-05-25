const fs = require("fs");
let alerts = fs.readFileSync("src/modules/admin/components/GlobalAlerts.tsx", "utf8");
alerts = alerts.replace(
    "setCampaignAlerts(camps);",
    "console.log('[GlobalAlerts] Campaign Alerts:', camps);\n                  setCampaignAlerts(camps);"
);
fs.writeFileSync("src/modules/admin/components/GlobalAlerts.tsx", alerts);
