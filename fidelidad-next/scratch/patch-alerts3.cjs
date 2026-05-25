const fs = require("fs");
let alerts = fs.readFileSync("src/modules/admin/components/GlobalAlerts.tsx", "utf8");
alerts = alerts.replace(
    /const pendingC = campaignAlerts\.filter\(u => \{\s*if \(processedAlerts\[u\.alertId\]\) return false;\s*const camp = campaignsMap\.get\(u\.campId\);\s*if \(!camp\) return false; \/\/ Excluye campa.*?\s*const campStartDate = camp\.startDate \|\| camp\.flashDate \|\| null;\s*if \(campStartDate && campStartDate > todayStr\) return false;\s*if \(camp\.endDate && camp\.endDate < todayStr\) return false;\s*return true;\s*\}\);/gs,
    `const pendingC = campaignAlerts.filter(u => !processedAlerts[u.alertId]);`
);
alerts = alerts.replace(
    /const procC = campaignAlerts\.filter\(u => \{\s*if \(!processedAlerts\[u\.alertId\]\) return false;\s*const camp = campaignsMap\.get\(u\.campId\);\s*if \(!camp\) return false; \/\/ Excluye campa.*?\s*const campStartDate = camp\.startDate \|\| camp\.flashDate \|\| null;\s*if \(campStartDate && campStartDate > todayStr\) return false;\s*if \(camp\.endDate && camp\.endDate < todayStr\) return false;\s*return true;\s*\}\);/gs,
    `const procC = campaignAlerts.filter(u => !!processedAlerts[u.alertId]);`
);
fs.writeFileSync("src/modules/admin/components/GlobalAlerts.tsx", alerts);
