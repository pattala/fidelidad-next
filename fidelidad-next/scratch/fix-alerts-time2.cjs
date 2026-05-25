const fs = require("fs");
let lines = fs.readFileSync("src/modules/admin/components/GlobalAlerts.tsx", "utf8").split("\n");
const idx = lines.findIndex(l => l.includes("const qCampaigns = query("));
if (idx !== -1) {
    lines.splice(idx, 4,
        "            // Compensar desfasaje horario UTC del backend (hasta 24h)",
        "            const minCampaignQueryTimestamp = new Date(minQueryTimestamp.getTime() - 24 * 3600 * 1000);",
        "            const qCampaigns = query(",
        "                collection(db, 'audit_logs'),",
        "                where('type', '==', 'campaign_broadcast'),",
        "                where('timestamp', '>=', minCampaignQueryTimestamp)",
        "            );"
    );
    fs.writeFileSync("src/modules/admin/components/GlobalAlerts.tsx", lines.join("\n"));
}
let config = fs.readFileSync("src/lib/adminConfig.ts", "utf8");
config = config.replace("V.1.6.15", "V.1.6.16");
fs.writeFileSync("src/lib/adminConfig.ts", config);
