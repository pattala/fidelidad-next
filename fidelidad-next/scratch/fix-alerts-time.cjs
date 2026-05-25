const fs = require("fs");
let alerts = fs.readFileSync("src/modules/admin/components/GlobalAlerts.tsx", "utf8");
alerts = alerts.replace(
    "            const qCampaigns = query(\n                  collection(db, 'audit_logs'), \n                  where('type', '==', 'campaign_broadcast'),\n                  where('timestamp', '>=', minQueryTimestamp)\n              );",
    "            // Compensar desfasaje horario UTC del backend (hasta 24h)\n            const minCampaignQueryTimestamp = new Date(minQueryTimestamp.getTime() - 24 * 3600 * 1000);\n            const qCampaigns = query(\n                  collection(db, 'audit_logs'), \n                  where('type', '==', 'campaign_broadcast'),\n                  where('timestamp', '>=', minCampaignQueryTimestamp)\n              );"
);
fs.writeFileSync("src/modules/admin/components/GlobalAlerts.tsx", alerts);

let config = fs.readFileSync("src/lib/adminConfig.ts", "utf8");
config = config.replace("V.1.6.14", "V.1.6.15");
fs.writeFileSync("src/lib/adminConfig.ts", config);
