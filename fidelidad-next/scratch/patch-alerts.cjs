const fs = require("fs");
let alerts = fs.readFileSync("src/modules/admin/components/GlobalAlerts.tsx", "utf8");
alerts = alerts.replace(
    /const camp = campaignsMap\.get\(u\.campId\);\s*if \(!camp\) return false;.*?\s*if \(!camp\.active\) return false;.*/g,
    `const camp = campaignsMap.get(u.campId);\n          if (!camp) return false; // Excluye campañas huérfanas pero NO las desactivadas`
);
fs.writeFileSync("src/modules/admin/components/GlobalAlerts.tsx", alerts);
